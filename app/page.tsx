import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DmBadge, DmRankBadge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Lock, ArrowDown, ArrowUp, Play } from "lucide-react";

const TOKENS: { name: string; value: string; group: string }[] = [
  { name: "canvas", value: "#FAF9F7", group: "Netral" },
  { name: "surface", value: "#FFFFFF", group: "Netral" },
  { name: "surface-2", value: "#FCFBFA", group: "Netral" },
  { name: "track", value: "#F4F2EF", group: "Netral" },
  { name: "hairline", value: "#E8E4DE", group: "Netral" },
  { name: "hairline-2", value: "#D8D2C8", group: "Netral" },
  { name: "ink", value: "#1A1815", group: "Netral" },
  { name: "ink-2", value: "#6B655C", group: "Netral" },
  { name: "ink-3", value: "#9A938A", group: "Netral" },
  { name: "dm-cto", value: "#2D4E8F", group: "DM" },
  { name: "dm-headit", value: "#7E225E", group: "DM" },
  { name: "dm-finance", value: "#9A5B0A", group: "DM" },
  { name: "tint-cto", value: "#EDF1F8", group: "DM" },
  { name: "tint-headit", value: "#F7EDF3", group: "DM" },
  { name: "tint-finance", value: "#FAF1E6", group: "DM" },
  { name: "fill-cto", value: "#1E3A5F", group: "Fill" },
  { name: "fill-headit", value: "#9B4C77", group: "Fill" },
  { name: "fill-finance", value: "#EFD3A8", group: "Fill" },
  { name: "hc-cto", value: "#176FEA", group: "HC" },
  { name: "hc-headit", value: "#4C0B31", group: "HC" },
  { name: "hc-finance", value: "#F8CF95", group: "HC" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-[1120px] px-8 py-8">
      <div className="mb-8">
        <p className="label-caps mb-2">T01 · Design Token Preview</p>
        <h1 className="text-display">SysSelect GDSS</h1>
        <p className="mt-2 max-w-[640px] text-ink-2">
          Presisi Swiss · light-only · Geist Sans + Geist Mono self-hosted.
          Halaman ini memverifikasi token warna, tipografi, dan komponen dasar
          sebelum fondasi auth dan skema dibangun.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tipografi */}
        <Card>
          <CardHeader>
            <CardTitle>Tipografi</CardTitle>
            <CardDescription>Geist Sans · Geist Mono · tabular-nums</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-display">Display 26px / 600</div>
            <div className="text-h2">Heading 17px / 600</div>
            <div className="text-[14px]">Body 14px / 400 — teks paragraf standar.</div>
            <div className="text-small text-ink-2">Small 12.5px — caption sekunder.</div>
            <div className="label-caps">Label kapital 10.5px</div>
            <div className="mono num text-[13px] font-medium">
              Angka mono 13px: 923.341102 · 0.34045293
            </div>
            <div className="text-hero-num num">0.34045293</div>
          </CardContent>
        </Card>

        {/* Tombol */}
        <Card>
          <CardHeader>
            <CardTitle>Tombol</CardTitle>
            <CardDescription>
              4 varian · tinggi 36px · radius 7px · disabled wajib tooltip
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button variant="primary">
              <Play size={15} strokeWidth={1.5} /> Primer
            </Button>
            <Button variant="secondary">Sekunder</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" disabled disabledReason="Menunggu 3/3 penilaian">
              Disabled
            </Button>
          </CardContent>
        </Card>

        {/* Badge */}
        <Card>
          <CardHeader>
            <CardTitle>Badge &amp; Identitas DM</CardTitle>
            <CardDescription>
              Rank badge 19×19px · pemenang badge tinta, bukan warna baru
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <DmBadge role="cto">CTO · Chief Technology Officer</DmBadge>
              <DmBadge role="headit">HIT · Head of IT Infrastructure</DmBadge>
              <DmBadge role="finance">FIN · Finance Manager</DmBadge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-small text-ink-2">Peringkat:</span>
              <DmRankBadge role="cto" rank={1} />
              <DmRankBadge role="headit" rank={2} />
              <DmRankBadge role="finance" rank={3} />
              <DmRankBadge role="cto" rank={4} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="winner">Pilihan</Badge>
              <Badge variant="default">Netral</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="secondary">Sekunder</Badge>
            </div>
            <div className="flex items-center gap-3 text-small text-ink-2">
              <span className="inline-flex items-center gap-1">
                <ArrowDown size={13} strokeWidth={1.5} /> cost · lebih kecil lebih baik
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowUp size={13} strokeWidth={1.5} /> benefit · lebih besar lebih baik
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Kartu raised + state */}
        <Card raised>
          <CardHeader>
            <CardTitle>Kartu Raised</CardTitle>
            <CardDescription>
              Shadow lebih dalam + inner highlight 1px di tepi atas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-ink">
              <Check size={15} strokeWidth={1.5} /> Resep kartu DESIGN.md §3
            </div>
            <div className="flex items-center gap-2 text-ink-2">
              <Lock size={15} strokeWidth={1.5} /> Fase terkunci menulis alasan
            </div>
            <p className="text-small text-ink-2">
              Grain canvas 2.5% aktif di seluruh halaman (pointer-events none).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Tabel</CardTitle>
          <CardDescription>
            Header surface-2 · angka mono rata kanan · hover surface-2
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Poin Borda</TableHead>
                <TableHead className="text-right">Nilai</TableHead>
                <TableHead className="text-right">Peringkat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { v: "V3 · PT Infrastruktur Prima Digital", p: "923.341102", n: "0.34045293", r: 1 },
                { v: "V1 · PT Awan Nusantara Cloud", p: "816.846922", n: "0.30118656", r: 2 },
                { v: "V4 · PT Nusa Data Center", p: "534.775787", n: "0.19718172", r: 3 },
                { v: "V2 · PT Cloudra Teknologi", p: "437.132386", n: "0.16117879", r: 4 },
              ].map((row) => (
                <TableRow key={row.r}>
                  <TableCell className="font-semibold">{row.v}</TableCell>
                  <TableCell className="mono num text-right">{row.p}</TableCell>
                  <TableCell className="mono num text-right">{row.n}</TableCell>
                  <TableCell className="mono num text-right">{row.r}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Swatches */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Token Warna</CardTitle>
          <CardDescription>
            21 token dari docs/tokens.json · tidak ada warna di luar daftar ini
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {TOKENS.map((t) => (
              <div
                key={t.name}
                className="rounded-input border border-hairline bg-surface p-2.5"
              >
                <div
                  className="mb-2 h-7 rounded-badge border border-hairline"
                  style={{ backgroundColor: t.value }}
                />
                <div className="text-[11px] font-semibold text-ink">{t.name}</div>
                <div className="mono num text-[10px] text-ink-3">{t.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
