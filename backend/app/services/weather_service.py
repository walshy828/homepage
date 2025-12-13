"""
Homepage Dashboard - Weather Service
"""
from datetime import datetime
from typing import Optional
import httpx

from app.core.config import settings
from app.schemas import WeatherCurrent, WeatherForecastDay, WeatherResponse


class WeatherService:
    """Service for OpenWeatherMap integration."""
    
    BASE_URL = "https://api.openweathermap.org/data/2.5"
    
    def __init__(self):
        self._api_key = settings.weather_api_key
        self._units = settings.weather_units
    
    @property
    def is_available(self) -> bool:
        return bool(self._api_key)
    
    async def get_weather(self, location: str) -> Optional[WeatherResponse]:
        """Get current weather and forecast for a location."""
        if not self.is_available:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                # Prepare parameters based on input type (zip vs city)
                params = {
                    "appid": self._api_key,
                    "units": self._units
                }
                
                # Simple heuristic: if it looks like a numeric zip code, use zip param
                # Remove spaces and dashes to check if the rest are digits
                location = location.strip()
                clean_loc = location.replace(" ", "").replace("-", "")
                
                if clean_loc.isdigit():
                    # If it's a 5-digit zip, safely assume US if not specified, 
                    # but OWM defaults to US anyway. Let's pass it strictly as zip.
                    # appending ,us ensures it searches US zip codes specifically.
                    if len(clean_loc) == 5:
                         params["zip"] = f"{clean_loc},us"
                    else:
                         params["zip"] = location
                else:
                    params["q"] = location

                # Get current weather
                current_response = await client.get(
                    f"{self.BASE_URL}/weather",
                    params=params
                )
                current_response.raise_for_status()
                current_data = current_response.json()
                
                # Get forecast
                forecast_response = await client.get(
                    f"{self.BASE_URL}/forecast",
                    params=params
                )
                forecast_response.raise_for_status()
                forecast_data = forecast_response.json()
                
                # Parse current weather
                current = WeatherCurrent(
                    location=f"{current_data['name']}, {current_data['sys']['country']}",
                    temperature=current_data["main"]["temp"],
                    feels_like=current_data["main"]["feels_like"],
                    humidity=current_data["main"]["humidity"],
                    description=current_data["weather"][0]["description"],
                    icon=current_data["weather"][0]["icon"],
                    wind_speed=current_data["wind"]["speed"],
                    wind_direction=current_data["wind"].get("deg", 0),
                    visibility=current_data.get("visibility", 0),
                    pressure=current_data["main"]["pressure"],
                    sunrise=datetime.fromtimestamp(current_data["sys"]["sunrise"]),
                    sunset=datetime.fromtimestamp(current_data["sys"]["sunset"])
                )
                
                # Parse 5-day forecast (group by day)
                daily_forecasts = {}
                for item in forecast_data["list"]:
                    date = datetime.fromtimestamp(item["dt"]).date()
                    date_str = date.isoformat()
                    
                    if date_str not in daily_forecasts:
                        daily_forecasts[date_str] = {
                            "date": datetime.combine(date, datetime.min.time()),
                            "temps": [],
                            "descriptions": [],
                            "icons": [],
                            "pop": []
                        }
                    
                    daily_forecasts[date_str]["temps"].append(item["main"]["temp"])
                    daily_forecasts[date_str]["descriptions"].append(item["weather"][0]["description"])
                    daily_forecasts[date_str]["icons"].append(item["weather"][0]["icon"])
                    daily_forecasts[date_str]["pop"].append(item.get("pop", 0) * 100)
                
                # Convert to forecast objects (next 5 days)
                forecast = []
                for date_str in sorted(daily_forecasts.keys())[:5]:
                    day = daily_forecasts[date_str]
                    forecast.append(WeatherForecastDay(
                        date=day["date"],
                        temp_high=max(day["temps"]),
                        temp_low=min(day["temps"]),
                        description=max(set(day["descriptions"]), key=day["descriptions"].count),
                        icon=max(set(day["icons"]), key=day["icons"].count),
                        precipitation_chance=int(max(day["pop"]))
                    ))
                
                return WeatherResponse(current=current, forecast=forecast)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            print(f"Weather API error: {e}")
            print(f"Response content: {e.response.text}")
            raise e
        except Exception as e:
            print(f"Weather service error: {e}")
            raise e
    
    def get_icon_url(self, icon_code: str) -> str:
        """Get URL for weather icon."""
        return f"https://openweathermap.org/img/wn/{icon_code}@2x.png"


# Singleton instance  
weather_service = WeatherService()
