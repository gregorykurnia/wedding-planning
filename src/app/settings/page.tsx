"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { saveWeddingSettings, useWeddingSettings } from "@/lib/collections/settings";

export default function SettingsPage() {
  const { data: settings, loading } = useWeddingSettings();

  const [yourName, setYourName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [venue, setVenue] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setYourName(settings.yourName);
    setPartnerName(settings.partnerName);
    setWeddingDate(settings.weddingDate ?? "");
    setPartnerEmail(settings.partnerEmail);
    setVenue(settings.venue);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveWeddingSettings({
        yourName,
        partnerName,
        weddingDate: weddingDate || null,
        partnerEmail,
        venue,
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The basics for your wedding — shown across the dashboard.
        </p>
      </div>

      <Card className="max-w-xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-semibold">Wedding details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yourName">Your name</Label>
                <Input
                  id="yourName"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                  placeholder="Gregory Kurnia"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="partnerName">Partner&apos;s name</Label>
                <Input
                  id="partnerName"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Partner's name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="weddingDate">Wedding date</Label>
                <Input
                  id="weddingDate"
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="partnerEmail">Partner&apos;s email</Label>
                <Input
                  id="partnerEmail"
                  type="email"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  placeholder="partner@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Saved for later — not used for sign-in or shared access yet.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Venue name"
                />
              </div>

              <div className="mt-2 flex items-center gap-3">
                <Button type="submit" disabled={saving} className="gap-1.5">
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save
                </Button>
                {saved && !saving && (
                  <span className="text-xs text-muted-foreground">Saved.</span>
                )}
                {error && <span className="text-xs text-destructive">{error}</span>}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
