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

    async def archive_url(self, url: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
        """
        Archives a URL: Takes a screenshot and extracts content.
        Returns: (screenshot_path, content_path, title, error_message)
        """
        if not async_playwright:
            return None, None, None, "Playwright not installed"

        screenshot_path = None
        content_path = None
        title = None
        error = None

        try:
            async with async_playwright() as p:
                # Launch browser
                # Note: In docker, we might need specific args like --no-sandbox
                try:
                    browser = await p.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
                except Exception as e:
                    return None, None, None, f"Failed to launch browser: {str(e)}"

                try:
                    page = await browser.new_page()
                    # Set viewport for a good screenshot
                    await page.set_viewport_size({"width": 1280, "height": 800})
                    
                    # Navigate
                    await page.goto(url, wait_until="networkidle", timeout=60000)
                    
                    # Get Title
                    title = await page.title()
                    if not title:
                        title = url
                    
                    # Generate IDs
                    file_id = str(uuid.uuid4())
                    
                    # Screenshot
                    screenshot_filename = f"{file_id}.png"
                    abs_screenshot_path = os.path.join(self.screenshots_dir, screenshot_filename)
                    await page.screenshot(path=abs_screenshot_path, full_page=False) # Not full page to save size, or maybe full page? let's do standard view
                    
                    # Content (HTML)
                    content = await page.content()
                    
                    # Clean content (Optional: use Readability logic here, but for now exact HTML)
                    # Let's do a simple cleanup with BS4 to remove scripts for safety
                    soup = BeautifulSoup(content, 'html.parser')
                    for script in soup(["script", "style", "iframe", "noscript", "svg"]):
                        script.decompose()
                    
                    # Extract text only for "Reader Mode" or keep HTML?
                    # Keeping simplified HTML is better for formatting.
                    
                    # Extract main content using heuristics (simple version)
                    # Ideally use readability-lxml, but let's just save the body
                    body = soup.find('body')
                    if body:
                        clean_content = str(body)
                    else:
                        clean_content = str(soup)
                    
                    content_filename = f"{file_id}.html"
                    abs_content_path = os.path.join(self.archives_dir, content_filename)
                    
                    with open(abs_content_path, "w", encoding="utf-8") as f:
                        f.write(clean_content)
                    
                    # Return relative paths for DB (relative to data dir)
                    screenshot_path = f"screenshots/{screenshot_filename}"
                    content_path = f"archives/{content_filename}"
                    
                except Exception as e:
                    error = str(e)
                    logger.error(f"Archive error for {url}: {e}")
                finally:
                    await browser.close()
        except Exception as e:
             # Handle playwright crash
             error = f"Playwright error: {str(e)}"
                
        return screenshot_path, content_path, title, error
