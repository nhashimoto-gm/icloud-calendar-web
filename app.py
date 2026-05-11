from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv
import caldav
import os
from datetime import datetime, date, timedelta
import pytz

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".cal_QHscbPbHkHtU"))

app = Flask(__name__)


class _ScriptName:
    """Nginx の /calendar/ サブパスを Flask に伝える WSGI ミドルウェア"""
    def __init__(self, wsgi_app, prefix):
        self.app = wsgi_app
        self.prefix = prefix.rstrip("/")

    def __call__(self, environ, start_response):
        environ["SCRIPT_NAME"] = self.prefix
        return self.app(environ, start_response)


app.wsgi_app = _ScriptName(app.wsgi_app, "/calendar")

ICLOUD_CALDAV_URL = "https://caldav.icloud.com"

CALENDAR_COLORS = [
    "#3788d8", "#e74c3c", "#2ecc71", "#f39c12",
    "#9b59b6", "#1abc9c", "#e67e22", "#34495e",
]


def get_client():
    username = os.getenv("APPLE_ID")
    password = os.getenv("APPLE_APP_PASSWORD")
    if not username or not password:
        raise ValueError("APPLE_ID and APPLE_APP_PASSWORD must be set in .env")
    return caldav.DAVClient(
        url=ICLOUD_CALDAV_URL,
        username=username,
        password=password,
    )


def parse_vevent(component, calendar_name, color):
    try:
        dtstart = component.get("dtstart")
        dtend = component.get("dtend")
        if not dtstart:
            return None

        start_val = dtstart.dt
        end_val = dtend.dt if dtend else start_val

        all_day = isinstance(start_val, date) and not isinstance(start_val, datetime)

        if all_day:
            start_str = start_val.isoformat()
            end_str = end_val.isoformat()
        else:
            if hasattr(start_val, "tzinfo") and start_val.tzinfo is None:
                start_val = pytz.utc.localize(start_val)
            if hasattr(end_val, "tzinfo") and end_val.tzinfo is None:
                end_val = pytz.utc.localize(end_val)
            start_str = start_val.isoformat()
            end_str = end_val.isoformat()

        return {
            "title": str(component.get("summary", "(無題)")),
            "start": start_str,
            "end": end_str,
            "allDay": all_day,
            "color": color,
            "extendedProps": {
                "calendar": calendar_name,
                "description": str(component.get("description", "")),
                "location": str(component.get("location", "")),
            },
        }
    except Exception:
        return None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/events")
def get_events():
    try:
        start_str = request.args.get("start")
        end_str = request.args.get("end")

        def parse_dt(s):
            return datetime.fromisoformat(s.replace("Z", "+00:00").replace(" ", "+"))

        start_dt = parse_dt(start_str) if start_str else datetime.now(pytz.utc) - timedelta(days=7)
        end_dt   = parse_dt(end_str)   if end_str   else datetime.now(pytz.utc) + timedelta(days=60)

        client = get_client()
        principal = client.principal()
        calendars = principal.calendars()

        events = []
        for idx, calendar in enumerate(calendars):
            color = CALENDAR_COLORS[idx % len(CALENDAR_COLORS)]
            cal_name = calendar.name or f"カレンダー {idx + 1}"
            try:
                cal_events = calendar.date_search(
                    start=start_dt, end=end_dt, expand=True
                )
                for event in cal_events:
                    from icalendar import Calendar as iCalendar
                    cal = iCalendar.from_ical(event.data)
                    for component in cal.walk():
                        if component.name == "VEVENT":
                            parsed = parse_vevent(component, cal_name, color)
                            if parsed:
                                events.append(parsed)
            except Exception:
                continue

        return jsonify(events)

    except ValueError as e:
        return jsonify({"error": str(e)}), 401
    except Exception as e:
        return jsonify({"error": f"カレンダーの取得に失敗しました: {str(e)}"}), 500


@app.route("/api/calendars")
def get_calendars():
    try:
        client = get_client()
        principal = client.principal()
        calendars = principal.calendars()
        result = []
        for idx, cal in enumerate(calendars):
            result.append({
                "name": cal.name or f"カレンダー {idx + 1}",
                "color": CALENDAR_COLORS[idx % len(CALENDAR_COLORS)],
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)
