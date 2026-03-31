"""
PredictXI AI Prediction Agent

Uses Claude Opus 4.6 with web search to browse cricket sites daily
and generate data-driven match predictions.
"""

import os
import anthropic
from dotenv import load_dotenv
from schemas import AIPredictionResponse

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are PredictXI's AI cricket analyst. Your job is to research an upcoming
cricket match and produce an accurate prediction.

For every match, you MUST search for:
1. Recent form of both teams (last 5 matches)
2. Head-to-head record between the two teams
3. Venue/pitch conditions and which team performs better there
4. Any injury news or key player unavailability
5. Current season standings and momentum

After researching, respond ONLY with a JSON object in this exact format:
{
  "predicted_winner": "<full team name e.g. Mumbai Indians>",
  "win_probability": <float between 50 and 85>,
  "opponent_probability": <float = 100 - win_probability>,
  "insights": [
    "<insight 1 — specific stat or fact>",
    "<insight 2 — specific stat or fact>",
    "<insight 3 — specific stat or fact>"
  ]
}

Rules:
- win_probability + opponent_probability must equal 100
- Always provide exactly 3 insights
- Insights must be specific with numbers/stats, not generic
- predicted_winner must be the full team name shown in the prompt
"""


def get_prediction(team1: str, team2: str, venue: str, league: str, season: str) -> AIPredictionResponse:
    """
    Agent browses cricket sites and returns a structured prediction.
    Called once per match, result cached in DB.
    """

    prompt = f"""Research and predict the upcoming {league} {season} match:

**{team1} vs {team2}**
Venue: {venue}

Search for recent form, head-to-head stats, venue performance, and any team news.
Then provide your prediction in the required JSON format.
"""

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        tools=[
            {"type": "web_search_20260209", "name": "web_search"},
        ],
        messages=[{"role": "user", "content": prompt}],
    )

    # Extract the JSON text block from the response
    result_text = ""
    for block in response.content:
        if block.type == "text":
            result_text = block.text
            break

    # Parse into structured response
    import json
    data = json.loads(result_text)

    return AIPredictionResponse(
        predicted_winner=data["predicted_winner"],
        win_probability=float(data["win_probability"]),
        opponent_probability=float(data["opponent_probability"]),
        insights=data["insights"][:3],
    )


def get_prediction_safe(team1: str, team2: str, venue: str, league: str, season: str) -> AIPredictionResponse:
    """
    Wrapper with fallback to engine.py if agent fails (rate limit, API key missing, etc.)
    """
    try:
        return get_prediction(team1, team2, venue, league, season)
    except Exception as e:
        print(f"[prediction_agent] Agent failed: {e}. Falling back to engine.py")
        from engine import predict
        return predict(team1, team2, venue)
