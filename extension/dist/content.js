(() => {
  // src/lib/apiClient.js
  var DEFAULT_SETTINGS = {
    apiBaseUrl: "http://127.0.0.1:3847",
    apiPath: "/api/jobs",
    apiKey: ""
  };
  function extensionApi() {
    if (typeof chrome !== "undefined" && chrome.storage) return chrome;
    if (typeof browser !== "undefined" && browser.storage) return browser;
    return null;
  }
  function isNgrokHost(hostname) {
    return hostname.endsWith(".ngrok-free.dev") || hostname.endsWith(".ngrok.app") || hostname.endsWith(".ngrok-free.app");
  }
  function buildRequestHeaders(settings, requestUrl, withJsonBody) {
    const headers = { Accept: "application/json" };
    if (withJsonBody) {
      headers["Content-Type"] = "application/json";
    }
    if (settings.apiKey) {
      headers.Authorization = `Bearer ${settings.apiKey}`;
    }
    try {
      const host = new URL(requestUrl).hostname;
      if (isNgrokHost(host)) {
        headers["ngrok-skip-browser-warning"] = "true";
      }
    } catch {
    }
    return headers;
  }
  async function getExtensionSettings() {
    const ext = extensionApi();
    if (!ext?.storage?.sync) {
      throw new Error(
        "Extension APIs unavailable. Reload the extension and refresh this Upwork tab."
      );
    }
    const stored = await ext.storage.sync.get(DEFAULT_SETTINGS);
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...stored });
  }
  function normalizeSettings(settings) {
    const out = { ...DEFAULT_SETTINGS, ...settings };
    if (out.apiBaseUrl === "http://localhost:3847") {
      out.apiBaseUrl = "http://127.0.0.1:3847";
    }
    return out;
  }
  function buildEndpoint(settings) {
    const normalized = normalizeSettings(settings);
    const base = normalized.apiBaseUrl.replace(/\/+$/, "");
    const path = normalized.apiPath.startsWith("/") ? normalized.apiPath : `/${normalized.apiPath}`;
    return `${base}${path}`;
  }
  function isLoopbackHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }
  function wrapFetchError(err, endpoint, settings) {
    const message = err?.message || String(err);
    const base = normalizeSettings(settings).apiBaseUrl;
    if (message === "Failed to fetch") {
      if (isNgrokHost(new URL(base).hostname)) {
        return new Error(
          `Cannot reach ngrok dashboard at ${endpoint}. Keep web\\start-tunnel.cmd running on your PC, confirm https://yanking-bullish-negligent.ngrok-free.dev/api/health opens in ixBrowser, then reload the extension and Upwork tab.`
        );
      }
      return new Error(
        `Cannot reach dashboard at ${endpoint}. Run npm run dev in web/, check Server URL in the popup, Save + Allow. Base: ${base}`
      );
    }
    return err instanceof Error ? err : new Error(message);
  }
  async function hasHostPermissionForBaseUrl(baseUrl) {
    try {
      const url = new URL(baseUrl.replace(/\/+$/, ""));
      if (isLoopbackHost(url.hostname) || isNgrokHost(url.hostname)) {
        return true;
      }
      const ext = extensionApi();
      if (!ext?.permissions?.contains) {
        return true;
      }
      const originPattern = `${url.protocol}//${url.host}/*`;
      return ext.permissions.contains({ origins: [originPattern] });
    } catch {
      return false;
    }
  }
  async function postJobViaFetch(settings, payload) {
    const normalized = normalizeSettings(settings);
    const endpoint = buildEndpoint(normalized);
    const allowed = await hasHostPermissionForBaseUrl(normalized.apiBaseUrl);
    if (!allowed) {
      throw new Error(
        `Extension is not allowed to call ${normalized.apiBaseUrl}. Open popup \u2192 Save settings \u2192 Allow.`
      );
    }
    const headers = buildRequestHeaders(normalized, endpoint, true);
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
    } catch (err) {
      throw wrapFetchError(err, endpoint, normalized);
    }
    let body = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
      body = text ? { message: text.slice(0, 500) } : null;
    }
    if (!response.ok) {
      const detail = body?.error || body?.message || `Server responded with HTTP ${response.status}`;
      throw new Error(detail);
    }
    return { status: response.status, body };
  }
  async function submitJobToServer(settings, payload) {
    const ext = extensionApi();
    if (ext?.runtime?.sendMessage && ext.runtime.id) {
      try {
        const response = await ext.runtime.sendMessage({
          type: "SUBMIT_JOB",
          settings,
          payload
        });
        if (response?.ok) {
          return response.result;
        }
        if (response?.error) {
          throw new Error(response.error);
        }
      } catch (err) {
        const msg = err?.message || String(err);
        const retriable = msg.includes("Receiving end does not exist") || msg.includes("Extension context invalidated") || msg.includes("Could not establish connection");
        if (!retriable) {
          throw err instanceof Error ? err : new Error(msg);
        }
      }
    }
    return postJobViaFetch(settings, payload);
  }

  // src/lib/domUtils.js
  function cleanText(el) {
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  }
  function cleanTextNoTooltip(el) {
    if (!el) return "";
    const clone = el.cloneNode(true);
    clone.querySelectorAll(
      '[data-test="UpCTooltip"], [data-test*="tooltip"], .air3-tooltip-body, .air3-popper-content, [role="tooltip"], [class*="tooltip"], .air3-popper, [data-popper-placement]'
    ).forEach((node) => node.remove());
    let text = clone.textContent.replace(/\s+/g, " ").trim();
    text = text.replace(/Close the tooltip\b[^.]*?\.\s*/g, "");
    text = text.replace(/Close the tooltip\s*/g, "");
    return text.trim();
  }
  function queryFirst(panel, ...selectors) {
    for (const selector of selectors) {
      const el = panel.querySelector(selector);
      if (el) return el;
    }
    return null;
  }
  function stripTooltipNoise(value) {
    if (typeof value === "string") {
      return value.replace(/Close the tooltip\b[^.]*?\.\s*/g, "").replace(/Close the tooltip\s*/g, "").trim();
    }
    if (Array.isArray(value)) {
      return value.map(stripTooltipNoise);
    }
    return value;
  }

  // src/lib/extractJob.js
  function getDetailPanel() {
    const slider = document.querySelector('[class*="air3-slider-job-details"]');
    if (slider) return slider;
    const applyBtn = [...document.querySelectorAll("button, a")].find(
      (el) => el.textContent.trim() === "Apply now"
    );
    if (applyBtn) {
      let el = applyBtn.parentElement;
      let depth = 0;
      while (el && el !== document.body && depth < 20) {
        if (el.querySelector("h1,h2,h3,h4,h5,h6")) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 400 && rect.height > 400) return el;
        }
        el = el.parentElement;
        depth += 1;
      }
    }
    const onJobUrl = window.location.pathname.startsWith("/jobs/") || window.location.pathname.startsWith("/freelance-jobs/") || /~\d+/.test(window.location.href);
    if (onJobUrl) {
      return document.querySelector("main") || document.body;
    }
    return null;
  }
  function getJobId(panel) {
    const link = panel.querySelector('a[href*="/jobs/~"]');
    if (link) {
      const match = link.getAttribute("href").match(/~(\d+)/);
      if (match) return match[1];
    }
    const urlMatch = window.location.href.match(/~(\d+)/);
    return urlMatch ? urlMatch[1] : null;
  }
  function parseClient(panel, clientContainer) {
    const client = {
      summaryLine: "",
      paymentVerified: null,
      phoneVerified: false,
      rating: null,
      reviewCount: null,
      location: null,
      jobsPosted: null,
      hireRate: null,
      openJobs: null,
      hires: null,
      totalSpent: null,
      avgHourlyRatePaid: null,
      totalHours: null,
      companyProfile: null,
      memberSince: null,
      rawParts: []
    };
    if (!clientContainer) return client;
    const paymentEl = clientContainer.querySelector('[data-test="payment-verified"]');
    if (paymentEl) {
      client.paymentVerified = true;
      client.rawParts.push("Payment verified");
    } else {
      const text = clientContainer.textContent;
      if (text.includes("Payment method verified")) {
        client.paymentVerified = true;
        client.rawParts.push("Payment verified");
      } else if (text.includes("Payment method not verified")) {
        client.paymentVerified = false;
        client.rawParts.push("Payment NOT verified");
      }
    }
    if (clientContainer.textContent.includes("Phone number verified")) {
      client.phoneVerified = true;
      client.rawParts.push("Phone verified");
    }
    let ratingFound = false;
    const ratingEl = clientContainer.querySelector('[data-test="UpCRating"]');
    if (ratingEl) {
      const ratingText = cleanTextNoTooltip(ratingEl);
      const match = ratingText.match(/([\d.]+)\s*of\s*(\d+)\s*reviews?/);
      if (match && parseFloat(match[1]) <= 5) {
        client.rating = parseFloat(match[1]);
        client.reviewCount = parseInt(match[2], 10);
        client.rawParts.push(`${match[1]} of ${match[2]} reviews`);
        ratingFound = true;
      }
    }
    if (!ratingFound) {
      const fbEl = clientContainer.querySelector('[data-test="feedback-rating"]');
      if (fbEl) {
        const fbText = cleanTextNoTooltip(fbEl);
        const match = fbText.match(/([\d.]+)\s*of\s*(\d+)\s*reviews?/);
        if (match && parseFloat(match[1]) <= 5) {
          client.rating = parseFloat(match[1]);
          client.reviewCount = parseInt(match[2], 10);
          client.rawParts.push(`${match[1]} of ${match[2]} reviews`);
          ratingFound = true;
        }
      }
    }
    if (!ratingFound) {
      const ctClean = cleanTextNoTooltip(clientContainer);
      const match = ctClean.match(/([\d.]+)\s*of\s*(\d+)\s*reviews?/);
      if (match && parseFloat(match[1]) <= 5) {
        client.rating = parseFloat(match[1]);
        client.reviewCount = parseInt(match[2], 10);
        client.rawParts.push(`${match[1]} of ${match[2]} reviews`);
      }
    }
    const locEl = clientContainer.querySelector('[data-qa="client-location"]');
    if (locEl) {
      const country = locEl.querySelector("strong");
      const city = locEl.querySelector("span.nowrap:not([data-test])");
      const parts = [];
      if (country && cleanText(country)) parts.push(cleanText(country));
      if (city && cleanText(city)) parts.push(cleanText(city));
      if (parts.length) {
        client.location = parts.join(", ");
        client.rawParts.push(client.location);
      }
    }
    const statsEl = clientContainer.querySelector('[data-qa="client-job-posting-stats"]');
    if (statsEl) {
      const strong = statsEl.querySelector("strong");
      if (strong) {
        client.jobsPosted = cleanText(strong);
        client.rawParts.push(client.jobsPosted);
      }
      const div = statsEl.querySelector("div");
      if (div) {
        const statsText = cleanText(div);
        statsText.split(",").map((s) => s.trim()).filter(Boolean).forEach((part) => {
          client.rawParts.push(part);
          const hireMatch = part.match(/(\d+)% hire rate/i);
          if (hireMatch) client.hireRate = hireMatch[1] + "%";
          const openMatch = part.match(/(\d+) open job/i);
          if (openMatch) client.openJobs = parseInt(openMatch[1], 10);
        });
      }
    }
    const hiresEl = clientContainer.querySelector('[data-qa="client-hires"]');
    if (hiresEl) {
      client.hires = cleanText(hiresEl);
      client.rawParts.push(client.hires);
    }
    const spentEl = queryFirst(
      clientContainer,
      '[data-test="total-spent"] strong',
      '[data-test="total-spent"]'
    );
    if (spentEl) {
      client.totalSpent = cleanText(spentEl);
      client.rawParts.push(client.totalSpent);
    } else {
      const spentMatch = clientContainer.textContent.match(/\$([\d,.]+K?)\s*total spent/);
      if (spentMatch) {
        client.totalSpent = `$${spentMatch[1]} total spent`;
        client.rawParts.push(client.totalSpent);
      }
    }
    const ctText = clientContainer.textContent;
    const avgRate = ctText.match(/\$([\d.]+)\s*\/hr\s*avg hourly rate/);
    if (avgRate) {
      client.avgHourlyRatePaid = `$${avgRate[1]}/hr`;
      client.rawParts.push(`$${avgRate[1]}/hr avg hourly rate paid`);
    }
    const totalHours = ctText.match(/([\d,]+)\s*hours/);
    if (totalHours) {
      client.totalHours = totalHours[1];
      client.rawParts.push(`${totalHours[1]} hours`);
    }
    const companyEl = clientContainer.querySelector('[data-qa="client-company-profile"]');
    if (companyEl) {
      client.companyProfile = cleanText(companyEl);
      if (client.companyProfile.length > 2) client.rawParts.push(client.companyProfile);
    }
    const memberEl = clientContainer.querySelector('[data-qa="client-contract-date"]');
    if (memberEl) {
      const memberText = cleanText(memberEl);
      client.memberSince = memberText.startsWith("Member") ? memberText : `Member since ${memberText}`;
      client.rawParts.push(client.memberSince);
    }
    client.summaryLine = client.rawParts.join(" | ");
    return client;
  }
  function extractJobFromPanel(panel) {
    const job = {
      title: "",
      description: "",
      posted: "",
      skills: [],
      client: null,
      connects: null,
      type: "",
      budget: "",
      bids: "",
      contractToHire: false,
      experience: "",
      duration: "",
      hours: "",
      projectType: "",
      proposals: "",
      activity: [],
      screeningQuestions: [],
      qualifications: [],
      url: ""
    };
    const titleEl = queryFirst(
      panel,
      '[data-test="job-tile-title-link"]',
      "h4 span.flex-1",
      "h1",
      "h2",
      "h3",
      "h4"
    );
    job.title = cleanText(titleEl) || "Unknown Title";
    const descContainer = queryFirst(panel, '[data-test~="Description"]');
    const descP = descContainer ? queryFirst(descContainer, "p.multiline-text", "p") : null;
    job.description = descP ? descP.textContent.trim() : descContainer ? descContainer.textContent.trim() : "";
    const postedEl = queryFirst(panel, '[data-test="PostedOn"]', ".posted-on-line");
    if (postedEl) {
      const dateDiv = postedEl.querySelector("[data-v-cc9d29f2]") || postedEl.querySelector("div") || postedEl;
      let postedText = cleanTextNoTooltip(dateDiv);
      postedText = postedText.replace(/\s*Worldwide\s*/g, " ").trim();
      job.posted = postedText.startsWith("Posted") ? postedText : postedText ? `Posted ${postedText}` : "";
    }
    let skillEls = panel.querySelectorAll('[data-test="token"] span');
    if (skillEls.length === 0) {
      skillEls = panel.querySelectorAll(".skills-list .air3-badge.badge, .skills-list .badge");
    }
    job.skills = [
      ...new Set(
        [...skillEls].map(cleanText).filter((skill) => skill.length > 0 && skill.length < 50)
      )
    ];
    let clientContainer = queryFirst(panel, '[data-test~="about-client-container"]');
    if (!clientContainer) {
      const headings = panel.querySelectorAll("h4, h5, h3, strong");
      for (const heading of headings) {
        if (cleanText(heading).includes("About the client")) {
          clientContainer = heading.closest("section") || heading.parentElement;
          break;
        }
      }
    }
    job.client = parseClient(panel, clientContainer);
    const connEl = queryFirst(
      panel,
      '[data-test="ConnectsDesktop"]',
      '[data-test~="connects"]'
    );
    if (connEl) {
      const match = cleanTextNoTooltip(connEl).match(/Required Connects[^:]*:\s*(\d+)/);
      job.connects = match ? parseInt(match[1], 10) : null;
    } else {
      const match = cleanTextNoTooltip(panel).match(
        /(?:Send a proposal for:|Required Connects[^:]*:)\s*(\d+)/
      );
      job.connects = match ? parseInt(match[1], 10) : null;
    }
    const featSection = queryFirst(panel, '[data-test~="Features"]') || (panel.querySelector("ul.features") ? panel.querySelector("ul.features").closest("section") : null);
    const featText = featSection ? featSection.textContent : cleanTextNoTooltip(panel);
    if (featSection) {
      const descDivs = featSection.querySelectorAll(".description");
      for (const div of descDivs) {
        const text = cleanText(div);
        if (text === "Hourly" || text.includes("Fixed")) {
          job.type = text;
          break;
        }
      }
    }
    if (!job.type) {
      if (featText.includes("Hourly")) job.type = "Hourly";
      else if (featText.includes("Fixed")) job.type = "Fixed-price";
    }
    const rangeMatch = featText.match(/\$([\d,.]+)\s*[-–]\s*\$([\d,.]+)/);
    if (rangeMatch) {
      job.budget = `$${rangeMatch[1]}-$${rangeMatch[2]}`;
    }
    if (!job.budget) {
      const fixedMatch = featText.match(/\$([\d,.]+)[\s\S]{0,20}Fixed/);
      if (fixedMatch) job.budget = `$${fixedMatch[1]}`;
    }
    if (!job.budget) {
      const estMatch = featText.match(/(?:Est\.?\s*)?[Bb]udget[:\s]*\$([\d,.]+)/);
      if (estMatch) job.budget = `$${estMatch[1]}`;
    }
    if (!job.budget) {
      const fixedBudgetEl = queryFirst(
        panel,
        '[data-test="is-fixed-price"] strong',
        '[data-test="BudgetAmount"] strong'
      );
      const hourlyBudgetEl = queryFirst(panel, '[data-test="is-hourly"] strong');
      if (fixedBudgetEl) job.budget = cleanText(fixedBudgetEl);
      else if (hourlyBudgetEl) job.budget = cleanText(hourlyBudgetEl);
    }
    const bidsEl = queryFirst(panel, '[data-test~="Bids"]');
    if (bidsEl) {
      const bt = bidsEl.textContent;
      const avg = bt.match(/Avg\s*\$([\d,.]+)/);
      const low = bt.match(/Low\s*\$([\d,.]+)/);
      const high = bt.match(/High\s*\$([\d,.]+)/);
      if (avg) {
        const parts = [];
        if (low) parts.push(`$${low[1]}`);
        parts.push(`avg $${avg[1]}`);
        if (high) parts.push(`$${high[1]}`);
        job.bids = parts.join(" \u2013 ");
      }
    }
    job.contractToHire = featText.includes("Contract-to-hire");
    const expEl = queryFirst(
      panel,
      '[data-test="experience-level"]',
      '[data-test="contractor-tier"]'
    );
    if (expEl) {
      job.experience = cleanText(expEl);
    } else if (featSection) {
      const strongs = featSection.querySelectorAll("strong");
      for (const strong of strongs) {
        const text = cleanText(strong);
        if (/^(Expert|Intermediate|Entry Level)$/i.test(text)) {
          job.experience = text;
          break;
        }
      }
    }
    if (!job.experience) {
      const exp = featText.match(/\b(Expert|Intermediate|Entry Level)\b/);
      job.experience = exp ? exp[0] : "";
    }
    const dur = featText.match(
      /(\d+\s*to\s*\d+\s*months|Less than (?:a|\d+) months?|More than \d+ months)/i
    );
    job.duration = dur ? dur[0] : "";
    const hrs = featText.match(
      /((?:Less|More) than \d+ hrs\/week|\d+\+?\s*hrs\/week|Hours to be determined)/i
    );
    job.hours = hrs ? hrs[0] : "";
    const seg = queryFirst(panel, '[data-test~="Segmentations"]', "ul.segmentations");
    if (seg) {
      const span = [...seg.querySelectorAll("span")].find((s) => cleanText(s));
      job.projectType = span ? cleanText(span) : "";
    }
    let activityEl = queryFirst(panel, '[data-test="ClientActivity"]');
    if (!activityEl) {
      const headings = panel.querySelectorAll("h5, h4");
      for (const heading of headings) {
        if (cleanText(heading).includes("Activity on this job")) {
          activityEl = heading.closest("section") || heading.parentElement;
          break;
        }
      }
    }
    if (activityEl) {
      const items = activityEl.querySelectorAll(".ca-item, li");
      for (const item of items) {
        const titleSpan = item.querySelector(".title");
        const label = titleSpan ? cleanText(titleSpan) : "";
        const fullText = cleanTextNoTooltip(item);
        const value = fullText.replace(label, "").trim();
        if (label.startsWith("Proposals")) {
          job.proposals = value;
        } else if (label && value) {
          job.activity.push({ label, value });
        }
      }
    }
    if (!job.proposals) {
      const propTier = queryFirst(panel, '[data-test="proposals-tier"] strong');
      if (propTier) {
        job.proposals = cleanText(propTier);
      } else {
        const propFallback = cleanTextNoTooltip(panel).match(
          /Proposals:\s*([\d+]+(?:\s*to\s*\d+)?|Less than \d+)/i
        );
        job.proposals = propFallback ? propFallback[1].trim() : "";
      }
    }
    const questionsSection = panel.querySelector('[data-test="Questions"]');
    if (questionsSection) {
      const items = questionsSection.querySelectorAll("ol > li, ul > li");
      for (const li of items) {
        const text = cleanText(li);
        if (text && text.length > 5) job.screeningQuestions.push(text);
      }
    }
    if (job.screeningQuestions.length === 0) {
      const questionEls = panel.querySelectorAll('[data-test="question"]');
      for (const qEl of questionEls) {
        job.screeningQuestions.push(cleanText(qEl));
      }
    }
    const qualHeadings = panel.querySelectorAll("h5, h4, h3, strong");
    for (const heading of qualHeadings) {
      if (cleanText(heading).toLowerCase().includes("preferred qualification")) {
        const container = heading.closest("section") || heading.parentElement;
        const items = container.querySelectorAll("ul.qualification-items li, li[data-cy]");
        if (items.length > 0) {
          for (const item of items) {
            const text = cleanTextNoTooltip(item);
            if (text && text.includes(":") && text.length < 100) {
              job.qualifications.push(text);
            }
          }
        }
        if (job.qualifications.length === 0) {
          const allItems = container.querySelectorAll("li, div > span");
          for (const item of allItems) {
            const text = cleanTextNoTooltip(item);
            if (text && text.includes(":") && text.length < 100) {
              job.qualifications.push(text);
            }
          }
        }
        break;
      }
    }
    const link = panel.querySelector('a[href*="/jobs/~"]');
    if (link) {
      const href = link.getAttribute("href");
      job.url = href.startsWith("http") ? href.split("?")[0] : `https://www.upwork.com${href.split("?")[0]}`;
    } else if (window.location.pathname.startsWith("/jobs/")) {
      job.url = window.location.origin + window.location.pathname;
    }
    return stripTooltipNoiseDeep(job);
  }
  function stripTooltipNoiseDeep(job) {
    const out = { ...job };
    for (const key of Object.keys(out)) {
      if (key === "client" && out.client) {
        out.client = { ...out.client, rawParts: stripTooltipNoise(out.client.rawParts) };
        out.client.summaryLine = stripTooltipNoise(out.client.summaryLine);
      } else {
        out[key] = stripTooltipNoise(out[key]);
      }
    }
    return out;
  }
  function extractCurrentJob() {
    const panel = getDetailPanel();
    if (!panel) {
      return { ok: false, error: "Open a job detail panel or job page on Upwork first." };
    }
    const job = extractJobFromPanel(panel);
    const upworkJobId = getJobId(panel);
    if (!upworkJobId) {
      return { ok: false, error: "Could not detect Upwork job ID from this page." };
    }
    return { ok: true, upworkJobId, job };
  }

  // src/lib/summary.js
  function firstSentences(text, maxChars = 320) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    if (normalized.length <= maxChars) return normalized;
    const slice = normalized.slice(0, maxChars);
    const lastPeriod = slice.lastIndexOf(". ");
    if (lastPeriod > 80) return slice.slice(0, lastPeriod + 1);
    return `${slice.trim()}\u2026`;
  }
  function skillPreview(skills, limit = 8) {
    if (!skills?.length) return "";
    const head = skills.slice(0, limit).join(", ");
    if (skills.length > limit) return `${head}, +${skills.length - limit} more`;
    return head;
  }
  function buildJobSummary({ job, upworkJobId }) {
    const lines = [];
    lines.push(job.title);
    const meta = [
      job.type,
      job.budget,
      job.experience,
      job.hours,
      job.duration,
      job.posted
    ].filter(Boolean);
    if (meta.length) lines.push(meta.join(" \xB7 "));
    if (job.proposals) lines.push(`Proposals: ${job.proposals}`);
    if (job.connects != null) lines.push(`Connects required: ${job.connects}`);
    const skills = skillPreview(job.skills);
    if (skills) lines.push(`Skills: ${skills}`);
    if (job.client?.summaryLine) {
      lines.push(`Client: ${job.client.summaryLine}`);
    }
    const blurb = firstSentences(job.description);
    if (blurb) {
      lines.push("");
      lines.push(blurb);
    }
    if (job.screeningQuestions?.length) {
      lines.push("");
      lines.push(
        `${job.screeningQuestions.length} screening question(s): ${job.screeningQuestions[0].slice(0, 120)}${job.screeningQuestions[0].length > 120 ? "\u2026" : ""}`
      );
    }
    lines.push("");
    lines.push(`Upwork ID: ~${upworkJobId}`);
    return lines.join("\n").trim();
  }

  // src/lib/payload.js
  var EXTENSION_VERSION = "1.0.0";
  function buildJobPayload({ upworkJobId, job }) {
    const capturedAt = (/* @__PURE__ */ new Date()).toISOString();
    return {
      source: "upwork-job-summarizer-extension",
      extensionVersion: EXTENSION_VERSION,
      capturedAt,
      upworkJobId: `~${upworkJobId}`,
      url: job.url || null,
      pipelineStatus: "new",
      summary: buildJobSummary({ job, upworkJobId }),
      job: {
        title: job.title,
        description: job.description,
        type: job.type || null,
        budget: job.budget || null,
        bids: job.bids || null,
        contractToHire: job.contractToHire,
        experienceLevel: job.experience || null,
        duration: job.duration || null,
        workload: job.hours || null,
        projectType: job.projectType || null,
        posted: job.posted || null,
        skills: job.skills,
        connectsRequired: job.connects,
        proposals: job.proposals || null,
        activity: job.activity,
        screeningQuestions: job.screeningQuestions,
        qualifications: job.qualifications
      },
      client: job.client
    };
  }

  // src/content/main.js
  var LOG_PREFIX = "[Upwork Summarizer]";
  var FAB_ID = "ujs-summary-fab";
  var INLINE_ID = "ujs-summary-inline";
  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }
  function showToast(message, type = "info") {
    let toast = document.getElementById("ujs-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ujs-toast";
      toast.className = "ujs-toast";
      document.body.appendChild(toast);
    }
    toast.dataset.type = type;
    toast.textContent = message;
    toast.classList.add("ujs-toast-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove("ujs-toast-visible");
    }, 4500);
  }
  function createSummaryButton({ id, className, label = "Summary" }) {
    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.className = className;
    btn.title = "Summarize job and send to dashboard";
    btn.innerHTML = `<span class="ujs-summary-fab-label">${label}</span>`;
    btn.addEventListener("click", onSummaryClick);
    return btn;
  }
  function findJobActionsContainer() {
    const triggers = [
      /save job/i,
      /buy connects to apply/i,
      /^apply now$/i,
      /submit a proposal/i,
      /apply for/i
    ];
    for (const el of document.querySelectorAll("button, a")) {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      if (!text || text.length > 80) continue;
      if (triggers.some((re) => re.test(text))) {
        return el.closest('[class*="actions"], [class*="sidebar"], section, div') || el.parentElement;
      }
    }
    return null;
  }
  function ensureFabButton() {
    if (document.getElementById(FAB_ID)) return;
    if (!document.body) return;
    const btn = createSummaryButton({
      id: FAB_ID,
      className: "ujs-summary-fab"
    });
    document.body.appendChild(btn);
    log("Floating Summary button ready");
  }
  function ensureInlineButton() {
    if (document.getElementById(INLINE_ID)) return;
    const container = findJobActionsContainer();
    if (!container) return;
    const btn = createSummaryButton({
      id: INLINE_ID,
      className: "ujs-summary-inline"
    });
    const saveBtn = [...container.querySelectorAll("button, a")].find(
      (el) => /save job/i.test(el.textContent)
    );
    if (saveBtn?.parentElement) {
      saveBtn.parentElement.insertBefore(btn, saveBtn.nextSibling);
    } else {
      container.appendChild(btn);
    }
    log("Inline Summary button added near job actions");
  }
  async function onSummaryClick() {
    for (const id of [FAB_ID, INLINE_ID]) {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = true;
        el.classList.add("ujs-summary-fab-loading");
      }
    }
    try {
      const extracted = extractCurrentJob();
      if (!extracted.ok) {
        showToast(extracted.error, "error");
        return;
      }
      const payload = buildJobPayload(extracted);
      showToast("Sending to your server\u2026", "info");
      const settings = await getExtensionSettings();
      await submitJobToServer(settings, payload);
      showToast("Job summarized and saved to server.", "success");
      log("Submitted job", payload.upworkJobId);
    } catch (err) {
      console.error(LOG_PREFIX, err);
      showToast(err.message || "Unexpected error.", "error");
    } finally {
      for (const id of [FAB_ID, INLINE_ID]) {
        const el = document.getElementById(id);
        if (el) {
          el.disabled = false;
          el.classList.remove("ujs-summary-fab-loading");
        }
      }
    }
  }
  function ensureUi() {
    ensureFabButton();
    ensureInlineButton();
  }
  function init() {
    log("Content script loaded on", window.location.href);
    ensureUi();
    setInterval(ensureUi, 1500);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
