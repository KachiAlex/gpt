-- notification_type was missing 'SUBMISSION': every new-submission
-- notification insert failed silently, so M&E/admins were never alerted.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'SUBMISSION';
