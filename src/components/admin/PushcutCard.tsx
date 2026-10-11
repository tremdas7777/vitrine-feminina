import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPushcutStatus, savePushcutFn, testPushcutFn } from "@/lib/pushcut.functions";

type Status = { pending: string | null; paid: string | null };

/** Traduz os erros do Pushcut (vêm em inglês, às vezes como JSON) para o que fazer. */
function explainPushcutError(r: { status?: number | undefined; error?: string | undefined }) {
  const raw = r.error ?? "";
  let msg = raw;
  try {
    msg = String((JSON.parse(raw) as { error?: unknown }).error ?? raw);
  } catch {
    // texto puro
  }
  if (/invalid secret/i.test(msg))
    return "a URL do webhook está errada ou incompleta. No app do Pushcut, abra a notificação, toque em Webhook, copie a URL inteira de novo e salve.";
  if (/notification.*not found|not found/i.test(msg) || r.status === 404)
    return "o Pushcut não encontrou essa notificação. Confira se ela existe no app com o mesmo nome que está no fim da URL, copie a URL de novo e salve.";
  if (r.status === 401 || r.status === 403)
    return "acesso recusado pelo Pushcut. Copie a URL do webhook de novo no app e salve.";
  if (r.status === 429) return "muitas notificações seguidas. Espere um minuto e teste de novo.";
  if (/abort/i.test(msg)) return "o Pushcut demorou para responder. Tente de novo.";
  return msg || `erro ${r.status ?? ""}`;
}

/** Notificações de venda no celular (Pushcut): Pix gerado e Pix pago, com o valor. */
export function PushcutCard({ password }: { password: string }) {
  const statusFn = useServerFn(getPushcutStatus);
  const saveFn = useServerFn(savePushcutFn);
  const testFn = useServerFn(testPushcutFn);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState("");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () =>
    statusFn({ data: { password } })
      .then(setStatus)
      .catch(() => setStatus(null));

  useEffect(() => {
    if (password) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const save = () =>
    run("save", async () => {
      await saveFn({ data: { password, pending: pending.trim(), paid: paid.trim() } });
      setPending("");
      setPaid("");
      return "Webhooks do Pushcut salvos.";
    });

  const clear = () =>
    run("clear", async () => {
      await saveFn({ data: { password, clear: true } });
      return "Webhooks do Pushcut apagados. As notificações pararam.";
    });

  const test = (kind: "pending" | "paid") =>
    run(`test-${kind}`, async () => {
      const r = await testFn({ data: { password, kind } });
      if (r.skipped) return "Cadastre um webhook do Pushcut antes de testar.";
      if (r.ok) return "Notificação de teste enviada (R$ 99,90). Confira no celular.";
      return `O Pushcut não aceitou: ${explainPushcutError(r)}`;
    });

  const configured = !!(status?.pending || status?.paid);

  return (
    <Card className="mt-3 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BellRing className="w-5 h-5 text-muted-foreground" aria-hidden />
          <div>
            <div className="font-medium">Notificações de venda (Pushcut)</div>
            <div className="text-xs text-muted-foreground">
              Avisa no celular com o valor da venda: venda pendente (Pix gerado) e venda paga. Cole
              os webhooks de notificação do app Pushcut (Notifications → Webhook). Se cadastrar só
              um, ele recebe os dois avisos.
            </div>
          </div>
        </div>
        <span
          className={`text-xs whitespace-nowrap ${configured ? "text-emerald-600" : "text-destructive"}`}
        >
          {status === null ? "…" : configured ? "Ativo" : "Sem URL"}
        </span>
      </div>

      <label className="text-sm">
        <span className="font-medium">Webhook de venda pendente</span>{" "}
        <span className="text-xs text-muted-foreground">(Pix gerado, aguardando pagamento)</span>
        <Input
          className="mt-1"
          autoComplete="off"
          placeholder={
            status?.pending
              ? `Em uso: ${status.pending}`
              : "https://api.pushcut.io/.../notifications/..."
          }
          value={pending}
          onChange={(e) => setPending(e.target.value)}
        />
      </label>
      <label className="text-sm">
        <span className="font-medium">Webhook de venda paga</span>{" "}
        <span className="text-xs text-muted-foreground">(Pix pago, venda aprovada)</span>
        <Input
          className="mt-1"
          autoComplete="off"
          placeholder={
            status?.paid ? `Em uso: ${status.paid}` : "https://api.pushcut.io/.../notifications/..."
          }
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={(!pending.trim() && !paid.trim()) || !!busy} onClick={save}>
          {busy === "save" ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!configured || !!busy}
          onClick={() => test("pending")}
        >
          {busy === "test-pending" ? "Enviando…" : "Testar venda pendente"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!configured || !!busy}
          onClick={() => test("paid")}
        >
          {busy === "test-paid" ? "Enviando…" : "Testar venda paga"}
        </Button>
        <Button size="sm" variant="destructive" disabled={!configured || !!busy} onClick={clear}>
          {busy === "clear" ? "Apagando…" : "Apagar webhooks"}
        </Button>
      </div>
      {msg && <p className="text-xs">{msg}</p>}
    </Card>
  );
}
