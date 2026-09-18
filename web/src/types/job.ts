export type PipelineStatus =
  | "new"
  | "reviewing"
  | "bid_planned"
  | "bid_sent"
  | "interview"
  | "won"
  | "lost"
  | "passed";

export type JobClient = {
  summaryLine?: string;
  paymentVerified?: boolean | null;
  phoneVerified?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
  location?: string | null;
  jobsPosted?: string | null;
  hireRate?: string | null;
  openJobs?: number | null;
  hires?: string | null;
  totalSpent?: string | null;
  avgHourlyRatePaid?: string | null;
  totalHours?: string | null;
  companyProfile?: string | null;
  memberSince?: string | null;
  rawParts?: string[];
};

export type JobActivityItem = {
  label: string;
  value: string;
};

export type ExtensionJobPayload = {
  source?: string;
  extensionVersion?: string;
  capturedAt?: string;
  upworkJobId: string;
  url?: string | null;
  pipelineStatus?: PipelineStatus;
  summary?: string;
  job?: {
    title?: string;
    description?: string;
    type?: string | null;
    budget?: string | null;
    bids?: string | null;
    contractToHire?: boolean;
    experienceLevel?: string | null;
    duration?: string | null;
    workload?: string | null;
    projectType?: string | null;
    posted?: string | null;
    skills?: string[];
    connectsRequired?: number | null;
    proposals?: string | null;
    activity?: JobActivityItem[];
    screeningQuestions?: string[];
    qualifications?: string[];
  };
  client?: JobClient | null;
};

export type JobRecord = ExtensionJobPayload & {
  id: string;
  receivedAt: string;
  updatedAt: string;
  pipelineStatus: PipelineStatus;
  notes?: string;
};
