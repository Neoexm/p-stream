import {
  MessagesMetadata,
  sendToBackgroundViaRelay,
} from "@plasmohq/messaging";

import { isAllowedExtensionVersion } from "@/backend/extension/compatibility";
import { ExtensionMakeRequestResponse } from "@/backend/extension/plasmo";
import { conf } from "@/setup/config";

export const RULE_IDS = {
  PREPARE_STREAM: 1,
  SET_DOMAINS_HLS: 2,
  SET_DOMAINS_HLS_AUDIO: 3,
};

// for some reason, about 500 ms is needed after
// page load before the extension starts responding properly
const isExtensionReady = new Promise<void>((resolve) => {
  setTimeout(() => {
    resolve();
  }, 500);
});

let activeExtension = false;

async function sendMessage<MessageKey extends keyof MessagesMetadata>(
  message: MessageKey,
  payload: MessagesMetadata[MessageKey]["req"] | undefined = undefined,
  timeout: number = -1,
) {
  await isExtensionReady;
  return new Promise<MessagesMetadata[MessageKey]["res"] | null>(
    async (resolve) => {
      if (timeout >= 0) setTimeout(() => resolve(null), timeout);

      try {
        const res = await sendToBackgroundViaRelay<
          MessagesMetadata[MessageKey]["req"],
          MessagesMetadata[MessageKey]["res"]
        >({
          name: message,
          body: payload,
        });
        activeExtension = true;
        resolve(res);
        return;
      } catch (e) {
        activeExtension = false;
      }

      // Extension not available — try backend fallback if configured
      const backend = conf().BACKEND_URL;
      if (!backend) {
        resolve(null);
        return;
      }

      try {
        const url = `${backend.replace(/\/$/, "")}/api/extension/${String(
          message,
        )}`;

        // For simple 'hello' allow GET
        const method = String(message) === "hello" ? "GET" : "POST";

        const fetchOptions: RequestInit = {
          method,
          headers: { "Content-Type": "application/json" },
        };

        if (method === "POST") fetchOptions.body = JSON.stringify(payload ?? {});

        const r = await fetch(url, fetchOptions);
        if (!r.ok) {
          resolve(null);
          return;
        }
        const json = await r.json();
        // Assume backend returns the same shape as the extension message response
        resolve(json as MessagesMetadata[MessageKey]["res"]);
        return;
      } catch (err) {
        // backend fallback failed
        resolve(null);
        return;
      }
    },
  );
}

export async function sendExtensionRequest<T>(
  ops: MessagesMetadata["makeRequest"]["req"],
): Promise<ExtensionMakeRequestResponse<T> | null> {
  return sendMessage("makeRequest", ops);
}

export async function setDomainRule(
  ops: MessagesMetadata["prepareStream"]["req"],
): Promise<MessagesMetadata["prepareStream"]["res"] | null> {
  return sendMessage("prepareStream", ops);
}

export async function sendPage(
  ops: MessagesMetadata["openPage"]["req"],
): Promise<MessagesMetadata["openPage"]["res"] | null> {
  return sendMessage("openPage", ops);
}

export async function extensionInfo(): Promise<
  MessagesMetadata["hello"]["res"] | null
> {
  const message = await sendMessage("hello", undefined, 500);
  return message;
}

export function isExtensionActiveCached(): boolean {
  return activeExtension;
}

export async function isExtensionActive(): Promise<boolean> {
  const info = await extensionInfo();
  if (!info?.success) return false;
  const allowedVersion = isAllowedExtensionVersion(info.version);
  if (!allowedVersion) return false;
  return info.allowed && info.hasPermission;
}
