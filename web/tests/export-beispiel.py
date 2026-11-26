"""Erzeugt eine Test-Exportdatei wie aus Apple Health.
Aufruf: python3 web/tests/export-beispiel.py ZIEL.zip [MB_Füllmaterial]"""
import sys, zipfile, random, datetime as dt
out = sys.argv[1]; filler_mb = int(sys.argv[2]) if len(sys.argv) > 2 else 5
random.seed(3)
tz = "+0100"
def f(d): return d.strftime("%Y-%m-%d %H:%M:%S ") + tz
def rec(t, src, start, end, value, unit=None):
    u = f' unit="{unit}"' if unit else ""
    return f' <Record type="{t}" sourceName="{src}" sourceVersion="1" device="&lt;&lt;HKDevice&gt;&gt;"{u} creationDate="{f(end)}" startDate="{f(start)}" endDate="{f(end)}" value="{value}"/>\n'
lines = ['<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE HealthData [\n<!ELEMENT HealthData (ExportDate,Me,(Record|Workout)*)>\n]>\n<HealthData locale="de_DE">\n <ExportDate value="x"/>\n <Me HKCharacteristicTypeIdentifierBiologicalSex="x"/>\n']
# Füllmaterial: alte Daten (2019) vom iPhone
old = dt.datetime(2019, 1, 1)
chunk = rec("HKQuantityTypeIdentifierStepCount", "Antons iPhone", old, old, 120, "count")
lines.append(chunk * int(filler_mb * 1024 * 1024 / len(chunk)))
today = dt.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
for i in range(40, -1, -1):
    day = today - dt.timedelta(days=i)
    for h in range(7, 22 if i else max(8, dt.datetime.now().hour)):
        t = day + dt.timedelta(hours=h)
        lines.append(rec("HKQuantityTypeIdentifierStepCount", "RingConn", t, t + dt.timedelta(minutes=59), random.randint(300, 1100), "count"))
        lines.append(rec("HKQuantityTypeIdentifierStepCount", "Antons iPhone", t, t + dt.timedelta(minutes=30), random.randint(100, 900), "count"))
        lines.append(rec("HKQuantityTypeIdentifierActiveEnergyBurned", "RingConn", t, t + dt.timedelta(minutes=59), round(random.uniform(60, 200), 2), "kJ"))
        for m in (0, 20, 40):
            u = t + dt.timedelta(minutes=m)
            lines.append(' <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="RingConn" unit="count/min" creationDate="%s" startDate="%s" endDate="%s" value="%d">\n  <MetadataEntry key="HKMetadataKeyHeartRateMotionContext" value="0"/>\n </Record>\n' % (f(u), f(u), f(u), random.randint(60, 95)))
    lines.append(rec("HKQuantityTypeIdentifierRestingHeartRate", "RingConn", day + dt.timedelta(hours=7), day + dt.timedelta(hours=7), random.randint(51, 58), "count/min"))
    lines.append(rec("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", "RingConn", day + dt.timedelta(hours=4), day + dt.timedelta(hours=4), round(random.uniform(35, 60), 3), "ms"))
    lines.append(rec("HKQuantityTypeIdentifierOxygenSaturation", "RingConn", day + dt.timedelta(hours=3), day + dt.timedelta(hours=3), round(random.uniform(0.94, 0.99), 2), "%"))
    lines.append(rec("HKQuantityTypeIdentifierRespiratoryRate", "RingConn", day + dt.timedelta(hours=3), day + dt.timedelta(hours=3), round(random.uniform(13, 16), 1), "count/min"))
    t = day - dt.timedelta(minutes=random.randint(0, 90))
    end = t + dt.timedelta(hours=random.uniform(6.3, 8.2))
    lines.append(rec("HKCategoryTypeIdentifierSleepAnalysis", "RingConn", t, end, "HKCategoryValueSleepAnalysisInBed"))
    stages = ["AsleepCore", "AsleepDeep", "AsleepCore", "AsleepREM", "Awake"]
    k = 0
    while t < end:
        st = stages[k % 5]; k += 1
        e = min(end, t + dt.timedelta(minutes=random.randint(8, 15) if st == "Awake" else random.randint(25, 60)))
        lines.append(rec("HKCategoryTypeIdentifierSleepAnalysis", "RingConn", t, e, "HKCategoryValueSleepAnalysis" + st))
        t = e
    # iPhone-Schlaf (nur „Im Bett“) darf nicht stören
    lines.append(rec("HKCategoryTypeIdentifierSleepAnalysis", "Antons iPhone", day - dt.timedelta(hours=1), day + dt.timedelta(hours=7), "HKCategoryValueSleepAnalysisInBed"))
lines.append("</HealthData>\n")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("apple_health_export/export_cda.xml", "<x/>")
    z.writestr("apple_health_export/export.xml", "".join(lines))
print(out)
