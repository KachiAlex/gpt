/**
 * Progress Measurement Service
 * Calculates project progress based on contractor updates and M&E confirmations
 */

// Progress calculation weights
const PROGRESS_WEIGHTS = {
  MILESTONE_COMPLETION: 0.7,    // 70% weight for milestone completion
  PHYSICAL_PROGRESS: 0.2,       // 20% weight for physical progress updates
  QUALITY_VERIFICATION: 0.1     // 10% weight for quality verification
};

// Milestone types and their relative importance
const MILESTONE_IMPORTANCE = {
  'PROJECT_INITIATION': 0.05,      // 5%
  'DESIGN_APPROVAL': 0.10,         // 10%
  'FOUNDATION': 0.20,              // 20%
  'STRUCTURAL_WORK': 0.30,         // 30%
  'FINISHING_WORK': 0.25,          // 25%
  'FINAL_INSPECTION': 0.10         // 10%
};

/**
 * Calculate overall project progress
 * @param {Object} project - Project data
 * @param {Array} milestones - Project milestones
 * @param {Array} submissions - Contractor submissions
 * @param {Array} approvals - M&E approvals
 * @returns {Object} Progress calculation result
 */
export const calculateProjectProgress = (project, milestones, submissions, approvals) => {
  const result = {
    overallProgress: 0,
    milestoneProgress: 0,
    physicalProgress: 0,
    verifiedProgress: 0,
    breakdown: {
      milestones: {},
      submissions: {},
      verifications: {}
    },
    lastUpdate: null,
    confidence: 'HIGH' // HIGH, MEDIUM, LOW
  };

  // 1. Calculate Milestone-based Progress (70% weight)
  result.milestoneProgress = calculateMilestoneProgress(milestones, approvals);
  
  // 2. Calculate Physical Progress from Updates (20% weight)
  result.physicalProgress = calculatePhysicalProgress(submissions, approvals);
  
  // 3. Calculate Verified Progress (10% weight)
  result.verifiedProgress = calculateVerifiedProgress(approvals);

  // 4. Calculate Overall Weighted Progress
  result.overallProgress = Math.round(
    (result.milestoneProgress * PROGRESS_WEIGHTS.MILESTONE_COMPLETION) +
    (result.physicalProgress * PROGRESS_WEIGHTS.PHYSICAL_PROGRESS) +
    (result.verifiedProgress * PROGRESS_WEIGHTS.QUALITY_VERIFICATION)
  );

  // 5. Determine Confidence Level
  result.confidence = determineConfidenceLevel(submissions, approvals, milestones);

  // 6. Set Last Update
  result.lastUpdate = getLastProgressUpdate(submissions, approvals);

  return result;
};

/**
 * Calculate progress based on completed milestones
 */
const calculateMilestoneProgress = (milestones, approvals) => {
  if (!milestones || milestones.length === 0) return 0;

  let totalWeight = 0;
  let completedWeight = 0;

  milestones.forEach(milestone => {
    const weight = MILESTONE_IMPORTANCE[milestone.type] || (1 / milestones.length);
    totalWeight += weight;

    // Check if milestone is completed and verified by M&E
    const isCompleted = milestone.status === 'COMPLETED';
    const isVerified = approvals.some(approval => 
      approval.submissionId === milestone.submissionId && 
      approval.action === 'APPROVED'
    );

    if (isCompleted && isVerified) {
      completedWeight += weight;
    } else if (isCompleted) {
      // Partial credit for completed but unverified milestones
      completedWeight += weight * 0.8;
    }
  });

  return Math.round((completedWeight / totalWeight) * 100);
};

/**
 * Calculate progress based on physical progress updates
 */
const calculatePhysicalProgress = (submissions, approvals) => {
  if (!submissions || submissions.length === 0) return 0;

  // Get latest approved progress submissions
  const approvedProgressSubmissions = submissions
    .filter(sub => sub.type === 'PROGRESS' || sub.type === 'MILESTONE')
    .filter(sub => approvals.some(approval => 
      approval.submissionId === sub.id && approval.action === 'APPROVED'
    ))
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  if (approvedProgressSubmissions.length === 0) return 0;

  // Use the latest approved progress value
  return approvedProgressSubmissions[0].progress || 0;
};

/**
 * Calculate verified progress based on M&E confirmations
 */
const calculateVerifiedProgress = (approvals) => {
  if (!approvals || approvals.length === 0) return 0;

  const approvedCount = approvals.filter(approval => approval.action === 'APPROVED').length;
  const totalApprovals = approvals.length;

  // Quality score based on approval rate
  return Math.round((approvedCount / totalApprovals) * 100);
};

/**
 * Determine confidence level of progress calculation
 */
const determineConfidenceLevel = (submissions, approvals, milestones) => {
  const recentSubmissions = submissions.filter(sub => {
    const daysSinceSubmission = (Date.now() - new Date(sub.submittedAt)) / (1000 * 60 * 60 * 24);
    return daysSinceSubmission <= 30; // Within last 30 days
  });

  const approvalRate = approvals.length > 0 ? 
    approvals.filter(a => a.action === 'APPROVED').length / approvals.length : 0;

  const hasRecentActivity = recentSubmissions.length > 0;
  const highApprovalRate = approvalRate >= 0.8;
  const hasMilestones = milestones && milestones.length > 0;

  if (hasRecentActivity && highApprovalRate && hasMilestones) return 'HIGH';
  if (hasRecentActivity && (highApprovalRate || hasMilestones)) return 'MEDIUM';
  return 'LOW';
};

/**
 * Get the last progress update timestamp
 */
const getLastProgressUpdate = (submissions, approvals) => {
  const allDates = [
    ...submissions.map(s => new Date(s.submittedAt)),
    ...approvals.map(a => new Date(a.createdAt))
  ];

  if (allDates.length === 0) return null;

  return new Date(Math.max(...allDates));
};

/**
 * Calculate milestone completion percentage
 */
export const calculateMilestoneCompletion = (milestones) => {
  if (!milestones || milestones.length === 0) return 0;

  const completedMilestones = milestones.filter(m => m.status === 'COMPLETED').length;
  return Math.round((completedMilestones / milestones.length) * 100);
};

/**
 * Calculate project health score
 */
export const calculateProjectHealth = (project, submissions, approvals) => {
  const factors = {
    timelineAdherence: calculateTimelineAdherence(project),
    qualityScore: calculateQualityScore(submissions, approvals),
    submissionFrequency: calculateSubmissionFrequency(submissions),
    approvalRate: calculateApprovalRate(approvals),
    issueFrequency: calculateIssueFrequency(submissions)
  };

  // Weighted health score
  const healthScore = 
    (factors.timelineAdherence * 0.3) +
    (factors.qualityScore * 0.25) +
    (factors.submissionFrequency * 0.15) +
    (factors.approvalRate * 0.20) +
    (factors.issueFrequency * 0.10);

  return {
    score: Math.round(healthScore),
    factors,
    status: healthScore >= 80 ? 'EXCELLENT' : 
            healthScore >= 60 ? 'GOOD' : 
            healthScore >= 40 ? 'FAIR' : 'POOR'
  };
};

/**
 * Calculate timeline adherence
 */
const calculateTimelineAdherence = (project) => {
  const now = new Date();
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.expectedEndDate);
  
  const totalDuration = endDate - startDate;
  const elapsedTime = now - startDate;
  const expectedProgress = Math.min((elapsedTime / totalDuration) * 100, 100);
  
  const actualProgress = project.progress || 0;
  
  // Calculate adherence (100% if on or ahead of schedule)
  if (actualProgress >= expectedProgress) return 100;
  
  const adherence = (actualProgress / expectedProgress) * 100;
  return Math.max(0, Math.round(adherence));
};

/**
 * Calculate quality score from submissions
 */
const calculateQualityScore = (submissions, approvals) => {
  if (!submissions || submissions.length === 0) return 100;

  const qualitySubmissions = submissions.filter(s => s.qualityScore);
  if (qualitySubmissions.length === 0) return 100;

  const avgQuality = qualitySubmissions.reduce((sum, s) => sum + s.qualityScore, 0) / qualitySubmissions.length;
  return Math.round((avgQuality / 5) * 100); // Convert 5-star to percentage
};

/**
 * Calculate submission frequency score
 */
const calculateSubmissionFrequency = (submissions) => {
  if (!submissions || submissions.length === 0) return 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentSubmissions = submissions.filter(s => new Date(s.submittedAt) >= thirtyDaysAgo);
  
  // Ideal: 4-8 submissions per month
  const frequency = recentSubmissions.length;
  if (frequency >= 4 && frequency <= 8) return 100;
  if (frequency >= 2 && frequency <= 12) return 80;
  if (frequency >= 1) return 60;
  return 20;
};

/**
 * Calculate approval rate
 */
const calculateApprovalRate = (approvals) => {
  if (!approvals || approvals.length === 0) return 100;

  const approvedCount = approvals.filter(a => a.action === 'APPROVED').length;
  return Math.round((approvedCount / approvals.length) * 100);
};

/**
 * Calculate issue frequency (inverse scoring - fewer issues = better score)
 */
const calculateIssueFrequency = (submissions) => {
  if (!submissions || submissions.length === 0) return 100;

  const issueSubmissions = submissions.filter(s => s.type === 'ISSUE' || s.type === 'SAFETY');
  const issueRate = issueSubmissions.length / submissions.length;
  
  // Lower issue rate = higher score
  return Math.round((1 - issueRate) * 100);
};

/**
 * Generate progress report for a project
 */
export const generateProgressReport = (project, milestones, submissions, approvals) => {
  const progressData = calculateProjectProgress(project, milestones, submissions, approvals);
  const healthData = calculateProjectHealth(project, submissions, approvals);
  
  return {
    projectId: project.id,
    projectName: project.name,
    reportDate: new Date(),
    progress: progressData,
    health: healthData,
    recommendations: generateRecommendations(progressData, healthData),
    alerts: generateAlerts(project, progressData, healthData)
  };
};

/**
 * Generate recommendations based on progress and health
 */
const generateRecommendations = (progressData, healthData) => {
  const recommendations = [];

  if (progressData.confidence === 'LOW') {
    recommendations.push({
      type: 'URGENT',
      title: 'Increase Submission Frequency',
      description: 'Project lacks recent updates. Require more frequent contractor submissions.'
    });
  }

  if (healthData.factors.timelineAdherence < 80) {
    recommendations.push({
      type: 'WARNING',
      title: 'Timeline Risk',
      description: 'Project is behind schedule. Consider resource reallocation or timeline adjustment.'
    });
  }

  if (healthData.factors.approvalRate < 70) {
    recommendations.push({
      type: 'ACTION',
      title: 'Quality Improvement',
      description: 'Low approval rate indicates quality issues. Implement additional oversight.'
    });
  }

  return recommendations;
};

/**
 * Generate alerts for project issues
 */
const generateAlerts = (project, progressData, healthData) => {
  const alerts = [];

  // Timeline alerts
  const daysToDeadline = (new Date(project.expectedEndDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysToDeadline <= 30 && progressData.overallProgress < 80) {
    alerts.push({
      level: 'CRITICAL',
      message: 'Project at risk of missing deadline',
      action: 'Immediate intervention required'
    });
  }

  // Quality alerts
  if (healthData.score < 40) {
    alerts.push({
      level: 'HIGH',
      message: 'Poor project health score',
      action: 'Schedule immediate review meeting'
    });
  }

  return alerts;
};
