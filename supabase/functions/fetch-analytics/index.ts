import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Create a JWT signed with RSA-SHA256 for Google APIs */
async function createGoogleJWT(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemContent = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(unsignedToken)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

/** Exchange JWT for an access token */
async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const jwt = await createGoogleJWT(serviceAccount);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth error: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

/** Run a GA4 Data API report */
async function runReport(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<any> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 API error [${res.status}]: ${err}`);
  }
  return res.json();
}

function getVal(row: any, idx: number): string {
  return row?.dimensionValues?.[idx]?.value || row?.metricValues?.[idx]?.value || "0";
}
function getMetric(row: any, idx: number): number {
  return parseInt(row?.metricValues?.[idx]?.value || "0", 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");

    const serviceAccount = JSON.parse(saJson);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabase
      .from("user_settings")
      .select("google_analytics_property_id")
      .eq("user_id", userId)
      .single();

    if (!settings?.google_analytics_property_id) {
      throw new Error("Google Analytics não configurado");
    }

    const propertyId = settings.google_analytics_property_id;
    const accessToken = await getAccessToken(serviceAccount);

    // Run multiple reports in parallel
    const [overviewReport, dailyReport, pagesReport, sourcesReport, devicesReport, countriesReport, hourlyReport] =
      await Promise.all([
        // 1. Overview metrics (30 days)
        runReport(accessToken, propertyId, {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "newUsers" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
            { name: "screenPageViewsPerSession" },
          ],
        }),
        // 2. Daily views
        runReport(accessToken, propertyId, {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "totalUsers" },
            { name: "sessions" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        }),
        // 3. Top pages
        runReport(accessToken, propertyId, {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "pagePath" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
          ],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 10,
        }),
        // 4. Traffic sources
        runReport(accessToken, propertyId, {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "sessionSource" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 8,
        }),
        // 5. Devices
        runReport(accessToken, propertyId, {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "totalUsers" }],
        }),
        // 6. Countries
        runReport(accessToken, propertyId, {
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "country" }],
          metrics: [{ name: "totalUsers" }],
          orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
          limit: 5,
        }),
        // 7. Hourly traffic
        runReport(accessToken, propertyId, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          dimensions: [{ name: "hour" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ dimension: { dimensionName: "hour" } }],
        }),
      ]);

    // Parse overview
    const oRow = overviewReport.rows?.[0];
    const pageviews = getMetric(oRow, 0);
    const sessions = getMetric(oRow, 1);
    const users = getMetric(oRow, 2);
    const newUsers = getMetric(oRow, 3);
    const bounceRate = Math.round(parseFloat(oRow?.metricValues?.[4]?.value || "0") * 100);
    const avgDurationSec = parseFloat(oRow?.metricValues?.[5]?.value || "0");
    const avgMin = Math.floor(avgDurationSec / 60);
    const avgSec = Math.floor(avgDurationSec % 60);
    const avgSessionDuration = `${avgMin}:${String(avgSec).padStart(2, "0")}`;
    const pagesPerSession = +(parseFloat(oRow?.metricValues?.[6]?.value || "0")).toFixed(1);

    // Parse daily views
    const dailyViews = (dailyReport.rows || []).map((row: any) => {
      const dateStr = getVal(row, 0); // YYYYMMDD
      const d = `${parseInt(dateStr.slice(6, 8))}/${parseInt(dateStr.slice(4, 6))}`;
      return {
        date: d,
        views: getMetric(row, 0),
        users: getMetric(row, 1),
        sessions: getMetric(row, 2),
      };
    });

    // Parse top pages
    const topPages = (pagesReport.rows || []).map((row: any) => {
      const durSec = parseFloat(row?.metricValues?.[1]?.value || "0");
      const m = Math.floor(durSec / 60);
      const s = Math.floor(durSec % 60);
      return {
        page: getVal(row, 0),
        views: getMetric(row, 0),
        avgTime: `${m}:${String(s).padStart(2, "0")}`,
      };
    });

    // Parse traffic sources
    const totalSourceSessions = (sourcesReport.rows || []).reduce(
      (sum: number, row: any) => sum + getMetric(row, 0),
      0
    );
    const trafficSources = (sourcesReport.rows || []).map((row: any) => ({
      source: getVal(row, 0) || "Direto",
      value: totalSourceSessions > 0
        ? Math.round((getMetric(row, 0) / totalSourceSessions) * 100)
        : 0,
    }));

    // Parse devices
    const totalDeviceUsers = (devicesReport.rows || []).reduce(
      (sum: number, row: any) => sum + getMetric(row, 0),
      0
    );
    const devices = (devicesReport.rows || []).map((row: any) => ({
      device: getVal(row, 0),
      value: totalDeviceUsers > 0
        ? Math.round((getMetric(row, 0) / totalDeviceUsers) * 100)
        : 0,
    }));

    // Parse countries
    const countryFlags: Record<string, string> = {
      Brazil: "🇧🇷", Portugal: "🇵🇹", "United States": "🇺🇸",
      Angola: "🇦🇴", Mozambique: "🇲🇿", Argentina: "🇦🇷",
      Spain: "🇪🇸", France: "🇫🇷", Germany: "🇩🇪", Japan: "🇯🇵",
      Mexico: "🇲🇽", Colombia: "🇨🇴", Chile: "🇨🇱", India: "🇮🇳",
      "United Kingdom": "🇬🇧", Canada: "🇨🇦", Italy: "🇮🇹",
    };
    const countries = (countriesReport.rows || []).map((row: any) => {
      const name = getVal(row, 0);
      const flag = countryFlags[name] || "🌍";
      return { country: `${flag} ${name}`, users: getMetric(row, 0) };
    });

    // Parse hourly traffic
    const hourlyTraffic = (hourlyReport.rows || []).map((row: any) => ({
      hour: `${getVal(row, 0).padStart(2, "0")}h`,
      views: getMetric(row, 0),
    }));

    // Build top referrers from sources
    const topReferrers = (sourcesReport.rows || []).slice(0, 5).map((row: any) => ({
      referrer: getVal(row, 0) || "(direct)",
      visits: getMetric(row, 0),
    }));

    const analytics = {
      pageviews,
      sessions,
      users,
      newUsers,
      bounceRate,
      avgSessionDuration,
      pagesPerSession,
      topPages,
      trafficSources,
      dailyViews,
      devices,
      countries,
      topReferrers,
      hourlyTraffic,
    };

    return new Response(JSON.stringify({ analytics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("fetch-analytics error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
