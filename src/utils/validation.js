/**
 * Form validation utilities
 */

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone) => {
  // Accepts various phone formats: +234, 234, 0, etc.
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const validateRequired = (value) => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined;
};

export const validateMinLength = (value, min) => {
  if (typeof value === 'string') {
    return value.trim().length >= min;
  }
  if (Array.isArray(value)) {
    return value.length >= min;
  }
  return false;
};

export const validateMaxLength = (value, max) => {
  if (typeof value === 'string') {
    return value.trim().length <= max;
  }
  if (Array.isArray(value)) {
    return value.length <= max;
  }
  return false;
};

export const validateNumber = (value, min = null, max = null) => {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  if (min !== null && num < min) return false;
  if (max !== null && num > max) return false;
  return true;
};

export const validateDate = (dateString, minDate = null, maxDate = null) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  if (minDate && date < new Date(minDate)) return false;
  if (maxDate && date > new Date(maxDate)) return false;
  return true;
};

export const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const validateURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateFile = (file, options = {}) => {
  const {
    allowedTypes = [],
    maxSize = 10 * 1024 * 1024, // 10MB default
    required = false
  } = options;

  if (!file && required) {
    return { valid: false, error: 'File is required' };
  }

  if (!file) {
    return { valid: true };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` 
    };
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    return { 
      valid: false, 
      error: `File size exceeds ${maxSizeMB}MB limit` 
    };
  }

  return { valid: true };
};

/**
 * Validate project form data
 */
export const validateProjectForm = (formData, step = null) => {
  const errors = {};

  // Step 1: Basic Information
  if (!step || step === 1) {
    if (!validateRequired(formData.name)) {
      errors.name = 'Project name is required';
    } else if (!validateMinLength(formData.name, 3)) {
      errors.name = 'Project name must be at least 3 characters';
    }

    if (!validateRequired(formData.description)) {
      errors.description = 'Project description is required';
    } else if (!validateMinLength(formData.description, 10)) {
      errors.description = 'Description must be at least 10 characters';
    }

    if (!validateRequired(formData.category)) {
      errors.category = 'Project category is required';
    }

    if (!formData.lga || formData.lga.length === 0) {
      errors.lga = 'At least one LGA is required';
    }
  }

  // Step 2: Budget & Timeline
  if (!step || step === 2) {
    if (!validateRequired(formData.budget)) {
      errors.budget = 'Budget is required';
    } else if (!validateNumber(formData.budget, 1)) {
      errors.budget = 'Budget must be a valid positive number';
    }

    if (!validateRequired(formData.startDate)) {
      errors.startDate = 'Start date is required';
    } else if (!validateDate(formData.startDate)) {
      errors.startDate = 'Invalid start date';
    }

    if (!validateRequired(formData.expectedEndDate)) {
      errors.expectedEndDate = 'Expected end date is required';
    } else if (!validateDate(formData.expectedEndDate)) {
      errors.expectedEndDate = 'Invalid end date';
    } else if (formData.startDate && validateDate(formData.expectedEndDate, formData.startDate)) {
      // Check if end date is after start date
      if (new Date(formData.expectedEndDate) <= new Date(formData.startDate)) {
        errors.expectedEndDate = 'End date must be after start date';
      }
    }

    if (!validateRequired(formData.fundingSource)) {
      errors.fundingSource = 'Funding source is required';
    }
  }

  // Step 3: Team & Stakeholders
  if (!step || step === 3) {
    if (!validateRequired(formData.projectManager)) {
      errors.projectManager = 'Project manager is required';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate contractor form data
 */
export const validateContractorForm = (formData) => {
  const errors = {};

  // Basic Information
  if (!validateRequired(formData.companyName)) {
    errors.companyName = 'Company name is required';
  }

  if (!validateRequired(formData.registrationNumber)) {
    errors.registrationNumber = 'Registration number is required';
  }

  // Contact Information
  if (!validateRequired(formData.contactPerson)) {
    errors.contactPerson = 'Contact person is required';
  }

  if (!validateRequired(formData.email)) {
    errors.email = 'Email is required';
  } else if (!validateEmail(formData.email)) {
    errors.email = 'Invalid email address';
  }

  if (!validateRequired(formData.phone)) {
    errors.phone = 'Phone number is required';
  } else if (!validatePhone(formData.phone)) {
    errors.phone = 'Invalid phone number';
  }

  if (!validateRequired(formData.address)) {
    errors.address = 'Address is required';
  }

  // Login Credentials
  if (!validateRequired(formData.password)) {
    errors.password = 'Password is required';
  } else if (!validatePassword(formData.password)) {
    errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
  }

  if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  // Business Information
  if (!validateRequired(formData.specialization)) {
    errors.specialization = 'Specialization is required';
  }

  if (formData.yearsInBusiness && !validateNumber(formData.yearsInBusiness, 0)) {
    errors.yearsInBusiness = 'Years in business must be a valid number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

