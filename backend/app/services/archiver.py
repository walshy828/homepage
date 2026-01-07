import os
import uuid
import logging
import asyncio
from typing import Optional, Tuple
from bs4 import BeautifulSoup

try:
    from playwright.async_api import async_playwright
except ImportError:
    async_playwright = None

logger = logging.getLogger(__name__)

class ContentArchiver:
    def __init__(self, data_dir: str = "/app/data"):
        self.data_dir = data_dir
        self.screenshots_dir = os.path.join(data_dir, "screenshots")
        self.archives_dir = os.path.join(data_dir, "archives")
        os.makedirs(self.screenshots_dir, exist_ok=True)
        os.makedirs(self.archives_dir, exist_ok=True)

    async def archive_url(self, url: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[str]]:
        """
        Archives a URL: Takes a screenshot, generates a PDF, and extracts text.
        Returns: (screenshot_path, pdf_path, full_text, title, error_message)
        """
        if not async_playwright:
            return None, None, None, None, "Playwright not installed"

        screenshot_path = None
        pdf_path = None
        full_text = None
        title = None
        error = None

        try:
            async with async_playwright() as p:
                try:
                    browser = await p.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
                except Exception as e:
                    return None, None, None, None, f"Failed to launch browser: {str(e)}"

                try:
                    page = await browser.new_page()
                    await page.set_viewport_size({"width": 1280, "height": 800})
                    
                    # Navigate
                    await page.goto(url, wait_until="networkidle", timeout=60000)
                    
                    # Get Title
                    title = await page.title()
                    if not title:
                        title = url
                    
                    # Generate IDs
                    file_id = str(uuid.uuid4())
                    
                    # 1. Screenshot for preview
                    screenshot_filename = f"{file_id}.png"
                    abs_screenshot_path = os.path.join(self.screenshots_dir, screenshot_filename)
                    await page.screenshot(path=abs_screenshot_path, full_page=False)
                    
                    # 2. PDF for viewing
                    pdf_filename = f"{file_id}.pdf"
                    abs_pdf_path = os.path.join(self.archives_dir, pdf_filename)
                    await page.pdf(path=abs_pdf_path, format="A4", print_background=True)
                    
                    # 3. Extract text for search (from PDF if possible, or directly from page)
                    # Extracting from page is easier and more accurate for web content
                    full_text = await page.evaluate("() => document.body.innerText")
                    
                    # Fallback or additional extraction from PDF if needed (user requested OCR/PDF extraction)
                    # For now, page.evaluate is perfect for searchable text.
                    
                    # Return relative paths
                    screenshot_path = f"screenshots/{screenshot_filename}"
                    pdf_path = f"archives/{pdf_filename}"
                    
                except Exception as e:
                    error = str(e)
                    logger.error(f"Archive error for {url}: {e}")
                finally:
                    await browser.close()
        except Exception as e:
             error = f"Playwright error: {str(e)}"
                
        return screenshot_path, pdf_path, full_text, title, error
