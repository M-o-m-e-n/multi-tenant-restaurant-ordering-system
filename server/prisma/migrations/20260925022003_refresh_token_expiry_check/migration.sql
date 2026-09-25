-- A refresh token cannot expire before it was issued (ERD section 8).
ALTER TABLE "RefreshToken" ADD CONSTRAINT "expiry_after_issue"
  CHECK ("expiresAt" > "createdAt");
