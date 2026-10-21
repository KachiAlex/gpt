import { Mail, Phone, Building, Check, X, Camera, Image } from 'lucide-react';

/**
 * Props come from the Settings shell, which owns form state because the
 * header-level "Save Changes"/"Reset" buttons act on it.
 */
export default function ProfileTab({
  user, formData, onInputChange,
  profileImage, profileImagePreview, fileInputRef,
  onFileSelect, onUploadClick, onRemovePhoto,
}) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-ink mb-6">Profile Information</h3>

        {/* Profile Photo */}
        <div className="flex items-center space-x-6 mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-soft rounded-full flex items-center justify-center overflow-hidden">
              {profileImagePreview || user?.profileImage ? (
                <img
                  src={profileImagePreview || user?.profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-soft-fg font-semibold text-xl">
                  {user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : 'U'}
                </span>
              )}
            </div>
            {(profileImagePreview || profileImage) && (
              <button
                onClick={onRemovePhoto}
                aria-label="Remove selected photo"
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={onFileSelect}
              className="hidden"
              capture="environment"
              aria-label="Upload profile photo"
            />
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <button onClick={onUploadClick} className="btn-secondary flex items-center space-x-2">
                  <Image className="h-4 w-4" />
                  <span>Choose from Gallery</span>
                </button>
                <button
                  onClick={() => {
                    const cameraInput = document.createElement('input');
                    cameraInput.type = 'file';
                    cameraInput.accept = 'image/*';
                    cameraInput.capture = 'camera';
                    cameraInput.onchange = onFileSelect;
                    cameraInput.click();
                  }}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Camera className="h-4 w-4" />
                  <span>Take Photo</span>
                </button>
              </div>
              <p className="text-xs text-muted">JPEG, PNG, GIF or WebP. Max 5MB.</p>
              {profileImage && (
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-700 dark:text-green-400" />
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                    {profileImage.name} selected ({(profileImage.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="profile-firstname" className="block text-sm font-medium text-ink mb-2">First Name</label>
            <input
              id="profile-firstname"
              type="text"
              value={formData.firstName}
              onChange={(e) => onInputChange('firstName', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter first name"
            />
          </div>
          <div>
            <label htmlFor="profile-lastname" className="block text-sm font-medium text-ink mb-2">Last Name</label>
            <input
              id="profile-lastname"
              type="text"
              value={formData.lastName}
              onChange={(e) => onInputChange('lastName', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter last name"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-ink mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                id="profile-email"
                type="email"
                value={formData.email}
                readOnly
                aria-readonly="true"
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-bg text-muted cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted mt-1">Email is your sign-in identity and can't be changed here — contact an administrator.</p>
          </div>
          <div>
            <label htmlFor="profile-phone" className="block text-sm font-medium text-ink mb-2">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                id="profile-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => onInputChange('phone', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter phone number"
              />
            </div>
          </div>
          <div>
            <label htmlFor="profile-jobtitle" className="block text-sm font-medium text-ink mb-2">Job Title</label>
            <input
              id="profile-jobtitle"
              type="text"
              value={formData.jobTitle}
              onChange={(e) => onInputChange('jobTitle', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter job title"
            />
          </div>
          <div>
            <label htmlFor="profile-department" className="block text-sm font-medium text-ink mb-2">Department</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
              <select
                id="profile-department"
                value={formData.department}
                onChange={(e) => onInputChange('department', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select department</option>
                <option value="Ministry of Works">Ministry of Works</option>
                <option value="Ministry of Health">Ministry of Health</option>
                <option value="Ministry of Education">Ministry of Education</option>
                <option value="Ministry of Water Resources">Ministry of Water Resources</option>
                <option value="Ministry of Agriculture">Ministry of Agriculture</option>
                <option value="Ministry of Commerce">Ministry of Commerce</option>
                <option value="Project Monitoring Unit">Project Monitoring Unit</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-ink mb-4">Address Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="profile-address" className="block text-sm font-medium text-ink mb-2">Street Address</label>
            <input
              id="profile-address"
              type="text"
              value={formData.address}
              onChange={(e) => onInputChange('address', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter street address"
            />
          </div>
          <div>
            <label htmlFor="profile-city" className="block text-sm font-medium text-ink mb-2">City</label>
            <input
              id="profile-city"
              type="text"
              value={formData.city}
              onChange={(e) => onInputChange('city', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter city"
            />
          </div>
          <div>
            <label htmlFor="profile-state" className="block text-sm font-medium text-ink mb-2">State</label>
            <input
              id="profile-state"
              type="text"
              value={formData.state}
              onChange={(e) => onInputChange('state', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter state"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
