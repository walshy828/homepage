"""
Homepage Dashboard - Gemini AI Service
"""
from typing import List, Optional
import google.generativeai as genai

from app.core.config import settings


# Link categories for AI classification
LINK_CATEGORIES = [
    "news",
    "sports", 
    "technology",
    "social",
    "work",
    "shopping",
    "entertainment",
    "education",
    "finance",
    "health",
    "travel",
    "food",
    "reference",
    "tools",
    "other"
]


class GeminiService:
    """Service for Gemini AI integration."""
    
    def __init__(self):
        self._model = None
        if settings.is_gemini_configured:
            genai.configure(api_key=settings.gemini_api_key)
            self._model = genai.GenerativeModel(settings.gemini_model)
    
    @property
    def is_available(self) -> bool:
        return self._model is not None
    
    async def categorize_link(self, url: str, title: Optional[str] = None, description: Optional[str] = None) -> str:
        """Categorize a single link using Gemini AI."""
        if not self.is_available:
            return "uncategorized"
        
        prompt = f"""Categorize this website/link into exactly ONE of these categories: {', '.join(LINK_CATEGORIES)}

URL: {url}
{f'Title: {title}' if title else ''}
{f'Description: {description}' if description else ''}

Respond with ONLY the category name, nothing else. If unsure, respond with "other"."""

        try:
            response = await self._model.generate_content_async(prompt)
            category = response.text.strip().lower()
            
            # Validate the category
            if category in LINK_CATEGORIES:
                return category
            return "other"
        except Exception as e:
            print(f"Gemini categorization error: {e}")
            return "uncategorized"
    
    async def categorize_links_batch(self, links: List[dict]) -> List[dict]:
        """Categorize multiple links in batch."""
        if not self.is_available:
            return [{"id": link["id"], "category": "uncategorized"} for link in links]
        
        results = []
        for link in links:
            category = await self.categorize_link(
                url=link["url"],
                title=link.get("title"),
                description=link.get("description")
            )
            results.append({"id": link["id"], "category": category})
        
        return results
    
    async def suggest_tags(self, url: str, title: Optional[str] = None) -> List[str]:
        """Suggest tags for a link."""
        if not self.is_available:
            return []
        
        prompt = f"""Suggest 3-5 relevant hashtags for this website/link. 
Tags should be single words or short phrases starting with #.
Avoid generic tags like #website or #link. Focus on the specific content or topic.

URL: {url}
{f'Title: {title}' if title else ''}

Respond with a comma-separated list of hashtags only, nothing else (e.g. #tech, #news, #coding)."""

        try:
            response = await self._model.generate_content_async(prompt)
            # Split, clean, and ensure valid hashtags
            raw_tags = [tag.strip().lower() for tag in response.text.split(",")]
            tags = []
            for tag in raw_tags:
                if not tag.startswith('#'):
                    tag = f'#{tag}'
                # Simple cleanup to remove any non-tag characters if AI hallucinates
                tag = tag.replace(' ', '')
                if len(tag) > 1 and tag not in tags:
                    tags.append(tag)
            
            return tags[:5]  # Limit to 5 tags
        except Exception as e:
            print(f"Gemini tag suggestion error: {e}")
            return []


# Singleton instance
gemini_service = GeminiService()
