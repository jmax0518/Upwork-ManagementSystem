import {
  cleanText,
  cleanTextNoTooltip,
  queryFirst,
  stripTooltipNoise,
} from "./domUtils.js";

export function getDetailPanel() {
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

  const onJobUrl =
    window.location.pathname.startsWith("/jobs/") ||
    window.location.pathname.startsWith("/freelance-jobs/") ||
    /~\d+/.test(window.location.href);

  if (onJobUrl) {
    return document.querySelector("main") || document.body;
  }

  return null;
}

export function getJobId(panel) {
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
    rawParts: [],
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
      statsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((part) => {
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

export function extractJobFromPanel(panel) {
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
    url: "",
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
  const descP = descContainer
    ? queryFirst(descContainer, "p.multiline-text", "p")
    : null;
  job.description = descP
    ? descP.textContent.trim()
    : descContainer
      ? descContainer.textContent.trim()
      : "";

  const postedEl = queryFirst(panel, '[data-test="PostedOn"]', ".posted-on-line");
  if (postedEl) {
    const dateDiv =
      postedEl.querySelector("[data-v-cc9d29f2]") || postedEl.querySelector("div") || postedEl;
    let postedText = cleanTextNoTooltip(dateDiv);
    postedText = postedText.replace(/\s*Worldwide\s*/g, " ").trim();
    job.posted = postedText.startsWith("Posted")
      ? postedText
      : postedText
        ? `Posted ${postedText}`
        : "";
  }

  let skillEls = panel.querySelectorAll('[data-test="token"] span');
  if (skillEls.length === 0) {
    skillEls = panel.querySelectorAll(".skills-list .air3-badge.badge, .skills-list .badge");
  }
  job.skills = [
    ...new Set(
      [...skillEls].map(cleanText).filter((skill) => skill.length > 0 && skill.length < 50)
    ),
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

  const featSection =
    queryFirst(panel, '[data-test~="Features"]') ||
    (panel.querySelector("ul.features")
      ? panel.querySelector("ul.features").closest("section")
      : null);
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
      job.bids = parts.join(" – ");
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
    job.url = href.startsWith("http")
      ? href.split("?")[0]
      : `https://www.upwork.com${href.split("?")[0]}`;
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

export function extractCurrentJob() {
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
