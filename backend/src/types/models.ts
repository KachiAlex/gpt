import { UserRole } from './domain';

export interface DbUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
  profileImage?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  id?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  profileImage?: string | null;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  profileImage?: string | null;
}

export interface DbContractorProfile {
  id: string;
  userId: string;
  companyName: string;
  registrationNo: string;
  contactPerson: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  rating: number;
  isVerified: boolean;
  isCertified: boolean;
  yearsExperience?: number | null;
  specialization: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractorUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
}

export interface ContractorWithUser extends DbContractorProfile {
  user: ContractorUserSummary | null;
}

export interface CreateContractorInput {
  userId: string;
  companyName: string;
  registrationNo: string;
  contactPerson: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  yearsExperience?: number | null;
  specialization: string[];
}

export interface UpdateContractorInput {
  companyName?: string;
  contactPerson?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  rating?: number;
  isVerified?: boolean;
  isCertified?: boolean;
  yearsExperience?: number | null;
  specialization?: string[];
}

export interface ContractorStats {
  totalProjects: number;
  completedProjects: number;
  activeProjects: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  pendingSubmissions: number;
  totalBudget: number;
  spentBudget: number;
  averageProjectProgress: number;
}

export interface ListContractorsParams {
  verified?: boolean;
  certified?: boolean;
  specialization?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface DbProject {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  lga: string[];
  priority: string;
  status: string;
  progress: number;
  budget: number;
  allocatedBudget: number;
  spentBudget: number;
  fundingSource?: string | null;
  startDate?: Date | null;
  expectedEndDate?: Date | null;
  actualEndDate?: Date | null;
  beneficiaries?: string | null;
  contractorId?: string | null;
  projectManagerId?: string | null;
  location?: any;
  isPublic: boolean;
  publishedAt?: Date | null;
  publishedBy?: string | null;
  qualityScore: number;
  safetyCompliance?: string | null;
  weatherDelay: number;
  safetyIncidents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  category: string;
  lga: string[];
  priority: string;
  budget: number;
  allocatedBudget?: number;
  fundingSource: string;
  startDate?: Date | null;
  expectedEndDate?: Date | null;
  actualEndDate?: Date | null;
  beneficiaries?: string | null;
  contractorId?: string | null;
  projectManagerId?: string | null;
  location?: any;
  isPublic?: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  category?: string;
  lga?: string[];
  priority?: string;
  status?: string;
  progress?: number;
  budget?: number;
  allocatedBudget?: number;
  spentBudget?: number;
  fundingSource?: string;
  startDate?: Date | null;
  expectedEndDate?: Date | null;
  actualEndDate?: Date | null;
  beneficiaries?: string | null;
  contractorId?: string | null;
  projectManagerId?: string | null;
  location?: any;
  isPublic?: boolean;
  qualityScore?: number;
  safetyCompliance?: string | null;
  weatherDelay?: number;
  safetyIncidents?: number;
}

export interface ListProjectsParams {
  status?: string;
  category?: string;
  priority?: string;
  contractorId?: string;
  lga?: string[];
  search?: string;
  page: number;
  limit: number;
}

export interface DbMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  dueDate?: Date | null;
  completedDate?: Date | null;
  status: string;
  progress: number;
  budget?: number | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbSubmissionSummary {
  id: string;
  projectId: string;
  contractorId: string;
  title: string;
  status: string;
  submittedAt: Date;
}

export interface DbSubmission {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  contractorId: string;
  submittedBy: string;
  type: string;
  title: string;
  description: string;
  progress?: number | null;
  estimatedValue?: number | null;
  priority: string;
  status: string;
  stage: string;
  qualityScore?: number | null;
  safetyCompliance?: string | null;
  weatherImpact?: string | null;
  mediaCount: number;
  dueDate?: Date | null;
  submittedAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  reviewComments?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubmissionInput {
  projectId: string;
  milestoneId?: string | null;
  contractorId: string;
  submittedBy: string;
  type: string;
  title: string;
  description: string;
  progress?: number | null;
  estimatedValue?: number | null;
  priority: string;
  qualityScore?: number | null;
  safetyCompliance?: string | null;
  weatherImpact?: string | null;
  dueDate?: Date | null;
}

export interface UpdateSubmissionInput {
  type?: string;
  title?: string;
  description?: string;
  progress?: number | null;
  estimatedValue?: number | null;
  priority?: string;
  status?: string;
  qualityScore?: number | null;
  safetyCompliance?: string | null;
  weatherImpact?: string | null;
  dueDate?: Date | null;
  mediaCount?: number;
  milestoneId?: string | null;
}

export interface ReviewSubmissionInput {
  action: string;
  comments?: string;
  qualityScore?: number | null;
  safetyCompliance?: string | null;
}

export interface ListSubmissionsParams {
  projectId?: string;
  contractorId?: string;
  status?: string;
  type?: string;
  priority?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface SubmissionListItem extends DbSubmission {
  project: {
    id: string;
    name: string | null;
    lga: string[];
  } | null;
  contractor: {
    id: string;
    companyName: string | null;
  } | null;
  submitter: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

export interface DbDocument {
  id: string;
  projectId?: string | null;
  submissionId?: string | null;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  category: string;
  uploadedBy: string;
  isPublic: boolean;
  createdAt: Date;
}

export interface CreateDocumentInput {
  projectId?: string | null;
  submissionId?: string | null;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  category: string;
  uploadedBy: string;
  isPublic?: boolean;
}

export interface ListDocumentsParams {
  projectId?: string;
  submissionId?: string;
  category?: string;
  uploadedBy?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface DbApproval {
  id: string;
  submissionId: string;
  reviewerId: string;
  action: string;
  comments?: string | null;
  createdAt: Date;
}

export interface DbNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  isUrgent: boolean;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  isUrgent?: boolean;
}

export interface DbReport {
  id: string;
  title: string;
  type: string;
  category?: string | null;
  generatedBy: string;
  generatedByName?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  data?: any;
  filePath?: string | null;
  fileSize?: number | null;
  isPublic: boolean;
  downloads: number;
  createdAt: Date;
}

export interface CreateReportInput {
  title: string;
  type: string;
  category?: string | null;
  generatedBy: string;
  startDate?: Date | null;
  endDate?: Date | null;
  data?: any;
  isPublic?: boolean;
}

export interface ListReportsParams {
  type?: string;
  category?: string;
  generatedBy?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
  department?: string | null;
  jobTitle?: string | null;
  lastLogin?: Date | null;
  createdAt: Date;
}
