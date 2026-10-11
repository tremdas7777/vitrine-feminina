import { trackEvent } from "@/lib/tracking";

type CheckoutClickPayload = {
  source: string;
  bundleId: string;
  bundleName: string;
  value: number;
};

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

export function trackCheckoutClick(payload: CheckoutClickPayload) {
  if (typeof window === "undefined") return;

  const event = {
    event: "checkout_click",
    currency: "BRL",
    ...payload,
  };

  window.dispatchEvent(new CustomEvent("vitrine:checkout_click", { detail: event }));
  (window as DataLayerWindow).dataLayer?.push(event);

  void trackEvent({
    event_type: "checkout_click",
    bundle_id: payload.bundleId,
    bundle_name: payload.bundleName,
    value: payload.value,
    metadata: { source: payload.source },
  });
}
