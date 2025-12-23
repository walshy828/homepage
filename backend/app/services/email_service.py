"""
Homepage Dashboard - Email Service
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending emails via SMTP."""
    
    def __init__(self):
        self.enabled = settings.is_email_configured
        if not self.enabled:
            print("WARNING: Email service is not configured. Emails will be logged but not sent.")
        else:
            print(f"INFO: Email service configured. Using host: {settings.smtp_host}")

    async def send_email(
        self, 
        to_email: str, 
        subject: str, 
        text_content: str, 
        html_content: Optional[str] = None
    ) -> bool:
        """Send an email."""
        if not self.enabled:
            print(f"DRY RUN: Sending email to {to_email} with subject: {subject}")
            print(f"Content: {text_content}")
            return True

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.smtp_from
        message["To"] = to_email

        # Add text part
        part1 = MIMEText(text_content, "plain")
        message.attach(part1)

        # Add HTML part if provided
        if html_content:
            part2 = MIMEText(html_content, "html")
            message.attach(part2)

        try:
            # Connect to SMTP server
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                if settings.smtp_tls:
                    server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_from, to_email, message.as_string())
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    async def send_password_reset_email(self, email: str, token: str):
        """Send a password reset link to user."""
        reset_url = f"{settings.base_url}/?token={token}"
        
        subject = "Reset Your Password - Homepage Dashboard"
        text_content = f"Click the link below to reset your password. The link will expire in 24 hours.\n\n{reset_url}"
        html_content = f"""
        <html>
            <body>
                <h2>Reset Your Password</h2>
                <p>You requested to reset your password for Homepage Dashboard.</p>
                <p>Click the button below to set a new password. This link will expire in 24 hours.</p>
                <a href="{reset_url}" 
                   style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                   Reset Password
                </a>
                <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
                    If you didn't request this, you can safely ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                <p style="color: #94a3b8; font-size: 12px;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    {reset_url}
                </p>
            </body>
        </html>
        """
        return await self.send_email(email, subject, text_content, html_content)


email_service = EmailService()
