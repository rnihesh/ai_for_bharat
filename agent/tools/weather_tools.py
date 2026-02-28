"""
Weather-related tools using Google Weather API
"""

import httpx
from typing import Dict, Any, Optional
from datetime import datetime
from config import config


class WeatherTools:
    """Tools for weather information using Google Weather API"""

    @staticmethod
    async def get_current_weather(lat: float, lng: float) -> Dict[str, Any]:
        """
        Get current weather for a location using Google Weather API

        Args:
            lat: Latitude
            lng: Longitude

        Returns:
            Weather information
        """
        if not config.weather.is_configured:
            return {
                "available": False,
                "error": "Weather API not configured",
            }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{config.weather.base_url}/currentConditions:lookup",
                    params={
                        "key": config.weather.api_key,
                        "location.latitude": lat,
                        "location.longitude": lng,
                    },
                )
                response.raise_for_status()
                data = response.json()

            # Parse Google Weather API response
            current = data.get("currentConditions", data)

            # Get temperature
            temp_data = current.get("temperature", {})
            temperature = temp_data.get("degrees") if temp_data else None

            # Get humidity
            humidity = current.get("relativeHumidity")

            # Get wind speed (convert from m/s if needed)
            wind_data = current.get("wind", {})
            wind_speed = wind_data.get("speed", {}).get("value") if wind_data else None

            # Get weather condition
            weather_code = current.get("weatherCondition", "UNKNOWN")
            condition = WeatherTools._map_weather_code(weather_code)

            # Check for rain conditions
            is_rainy = weather_code in [
                "RAIN", "LIGHT_RAIN", "HEAVY_RAIN",
                "SHOWERS", "DRIZZLE", "THUNDERSTORM"
            ]

            # Check for extreme conditions
            is_extreme = (
                (temperature is not None and (temperature > 40 or temperature < 5))
                or weather_code in ["THUNDERSTORM", "TORNADO", "HURRICANE"]
            )

            return {
                "available": True,
                "condition": condition,
                "description": current.get("weatherConditionText", condition),
                "temperature": temperature,
                "feels_like": current.get("feelsLikeTemperature", {}).get("degrees"),
                "humidity": humidity,
                "wind_speed": wind_speed,
                "is_rainy": is_rainy,
                "is_extreme": is_extreme,
                "visibility": current.get("visibility", {}).get("distance", 10000),
                "uv_index": current.get("uvIndex"),
                "precipitation": current.get("precipitation", {}).get("probability", 0),
            }
        except httpx.HTTPStatusError as e:
            return {
                "available": False,
                "error": f"Weather API error: {e.response.status_code}",
            }
        except Exception as e:
            return {
                "available": False,
                "error": f"Weather fetch error: {str(e)}",
            }

    @staticmethod
    async def get_weather_forecast(lat: float, lng: float, days: int = 3) -> Dict[str, Any]:
        """
        Get weather forecast for a location using Google Weather API

        Args:
            lat: Latitude
            lng: Longitude
            days: Number of days to forecast

        Returns:
            Weather forecast
        """
        if not config.weather.is_configured:
            return {
                "available": False,
                "error": "Weather API not configured",
            }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{config.weather.base_url}/forecast:lookup",
                    params={
                        "key": config.weather.api_key,
                        "location.latitude": lat,
                        "location.longitude": lng,
                        "days": days,
                    },
                )
                response.raise_for_status()
                data = response.json()

            forecasts = []
            forecast_days = data.get("forecastDays", data.get("dailyForecasts", []))

            for day in forecast_days[:days]:
                date_info = day.get("date", {})
                date_str = f"{date_info.get('year', '')}-{date_info.get('month', ''):02d}-{date_info.get('day', ''):02d}"

                day_part = day.get("daytimeForecast", day)
                weather_code = day_part.get("weatherCondition", "UNKNOWN")

                temp_high = day.get("maxTemperature", {}).get("degrees")
                temp_low = day.get("minTemperature", {}).get("degrees")

                precipitation_prob = day_part.get("precipitation", {}).get("probability", 0)

                forecasts.append({
                    "date": date_str,
                    "condition": WeatherTools._map_weather_code(weather_code),
                    "temperature_high": temp_high,
                    "temperature_low": temp_low,
                    "humidity": day_part.get("relativeHumidity"),
                    "rain_probability": precipitation_prob,
                })

            # Analyze forecast for rain
            rainy_days = sum(1 for f in forecasts if f.get("rain_probability", 0) > 50)

            return {
                "available": True,
                "forecasts": forecasts,
                "expected_rain": rainy_days > 0,
                "rain_probability_avg": sum(f.get("rain_probability", 0) for f in forecasts) / len(forecasts) if forecasts else 0,
            }
        except httpx.HTTPStatusError as e:
            return {
                "available": False,
                "error": f"Forecast API error: {e.response.status_code}",
            }
        except Exception as e:
            return {
                "available": False,
                "error": f"Forecast fetch error: {str(e)}",
            }

    @staticmethod
    def _map_weather_code(code: str) -> str:
        """Map Google Weather API condition codes to simple descriptions"""
        mapping = {
            "CLEAR": "Clear",
            "MOSTLY_CLEAR": "Mostly Clear",
            "PARTLY_CLOUDY": "Partly Cloudy",
            "CLOUDY": "Cloudy",
            "OVERCAST": "Overcast",
            "FOG": "Fog",
            "LIGHT_FOG": "Light Fog",
            "DRIZZLE": "Drizzle",
            "LIGHT_RAIN": "Light Rain",
            "RAIN": "Rain",
            "HEAVY_RAIN": "Heavy Rain",
            "SHOWERS": "Showers",
            "THUNDERSTORM": "Thunderstorm",
            "SNOW": "Snow",
            "LIGHT_SNOW": "Light Snow",
            "HEAVY_SNOW": "Heavy Snow",
            "SLEET": "Sleet",
            "HAIL": "Hail",
            "WINDY": "Windy",
            "TORNADO": "Tornado",
            "HURRICANE": "Hurricane",
            "DUST": "Dust",
            "SMOKE": "Smoke",
            "HAZE": "Haze",
            "UNKNOWN": "Unknown",
        }
        return mapping.get(code, code.replace("_", " ").title())

    @staticmethod
    def get_seasonal_factors(lat: float) -> Dict[str, Any]:
        """
        Get seasonal factors that might affect issue severity

        Args:
            lat: Latitude (to determine hemisphere)

        Returns:
            Seasonal factors
        """
        now = datetime.utcnow()
        month = now.month

        # Determine season based on hemisphere
        is_northern = lat >= 0

        if is_northern:
            if month in [6, 7, 8, 9]:  # Indian monsoon season
                season = "monsoon"
            elif month in [10, 11, 12, 1, 2]:
                season = "winter"
            else:
                season = "summer"
        else:
            if month in [12, 1, 2]:
                season = "summer"
            elif month in [6, 7, 8]:
                season = "winter"
            else:
                season = "transition"

        # Seasonal factors for India
        factors = {
            "monsoon": {
                "season": "monsoon",
                "pothole_severity_multiplier": 1.5,  # Potholes worse in monsoon
                "drainage_priority": True,
                "road_damage_risk": "high",
                "notes": "Monsoon season - water damage and potholes are critical",
            },
            "summer": {
                "season": "summer",
                "pothole_severity_multiplier": 1.0,
                "drainage_priority": False,
                "road_damage_risk": "medium",
                "notes": "Summer - heat may affect road surfaces",
            },
            "winter": {
                "season": "winter",
                "pothole_severity_multiplier": 1.2,
                "drainage_priority": False,
                "road_damage_risk": "medium",
                "notes": "Winter - reduced daylight, fog may affect visibility of issues",
            },
            "transition": {
                "season": "transition",
                "pothole_severity_multiplier": 1.0,
                "drainage_priority": False,
                "road_damage_risk": "low",
                "notes": "Transition season",
            },
        }

        return factors.get(season, factors["transition"])

    @staticmethod
    def get_time_factors() -> Dict[str, Any]:
        """
        Get time-of-day factors that might affect issue priority

        Returns:
            Time-based factors
        """
        now = datetime.utcnow()
        hour = now.hour

        # Adjust for IST (UTC+5:30)
        ist_hour = (hour + 5) % 24

        if 7 <= ist_hour < 10:
            period = "morning_rush"
            traffic_impact = "high"
        elif 17 <= ist_hour < 20:
            period = "evening_rush"
            traffic_impact = "high"
        elif 10 <= ist_hour < 17:
            period = "daytime"
            traffic_impact = "medium"
        elif 20 <= ist_hour < 23:
            period = "evening"
            traffic_impact = "low"
        else:
            period = "night"
            traffic_impact = "very_low"

        return {
            "period": period,
            "traffic_impact": traffic_impact,
            "ist_hour": ist_hour,
            "is_rush_hour": period in ["morning_rush", "evening_rush"],
            "is_night": period == "night",
            "visibility_concern": period == "night",
        }
