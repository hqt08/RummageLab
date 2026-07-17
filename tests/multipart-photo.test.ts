import { describe, expect, it } from "vitest";

import {
  parseTransientPhotoMultipart,
} from "../src/lib/runtime/multipart-photo";

function uploadRequest(
  photo: Uint8Array,
  headers?: HeadersInit,
): Request {
  const form = new FormData();
  form.set("operation", "photo_inventory");
  form.set("objectOnlyConfirmed", "true");
  form.set("ageStage", "3-4y");
  form.set("photo", new Blob([Buffer.from(photo)], { type: "image/jpeg" }), "private.jpg");
  const generated = new Request("http://local/upload", { method: "POST", body: form });
  const requestHeaders = new Headers(generated.headers);
  for (const [name, value] of new Headers(headers)) requestHeaders.set(name, value);
  return new Request(generated.url, {
    method: "POST",
    headers: requestHeaders,
    body: generated.body,
    duplex: "half",
  } as RequestInit);
}

function controlledTotalOverflowRequest(): Request {
  const chunk = new Uint8Array(1024 * 1024);
  let emitted = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (emitted >= 10) {
        controller.close();
        return;
      }
      emitted += 1;
      controller.enqueue(chunk);
    },
  });
  return new Request("http://local/upload", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=controlled" },
    body,
    duplex: "half",
  } as RequestInit);
}

describe("parseTransientPhotoMultipart", () => {
  it("streams the expected fields without retaining a filename", async () => {
    const request = uploadRequest(new Uint8Array([1, 2, 3]));
    const parsed = await parseTransientPhotoMultipart(request);

    expect(parsed).toEqual({
      operation: "photo_inventory",
      objectOnlyConfirmed: true,
      ageStage: "3-4y",
      photo: {
        bytes: new Uint8Array([1, 2, 3]),
        declaredType: "image/jpeg",
      },
    });
    expect(JSON.stringify(parsed)).not.toContain("private.jpg");
  });

  it("rejects an oversized file when Content-Length is absent", async () => {
    const request = uploadRequest(new Uint8Array(8 * 1024 * 1024 + 1));
    request.headers.delete("content-length");

    await expect(parseTransientPhotoMultipart(request)).rejects.toMatchObject({
      code: "photo_too_large",
    });
  });

  it("rejects an oversized file when Content-Length falsely claims one byte", async () => {
    const request = uploadRequest(
      new Uint8Array(8 * 1024 * 1024 + 1),
      { "content-length": "1" },
    );

    await expect(parseTransientPhotoMultipart(request)).rejects.toMatchObject({
      code: "photo_too_large",
    });
  });

  it("terminates a request over the total streaming limit", async () => {
    const request = controlledTotalOverflowRequest();

    await expect(parseTransientPhotoMultipart(request)).rejects.toMatchObject({
      code: "request_too_large",
    });
  });

  it("rejects duplicate or unexpected parts", async () => {
    const form = new FormData();
    form.append("operation", "photo_inventory");
    form.append("operation", "photo_inventory");
    form.append("objectOnlyConfirmed", "true");
    form.append("ageStage", "3-4y");
    form.append("photo", new Blob([Buffer.from([1])], { type: "image/jpeg" }), "x.jpg");
    const request = new Request("http://local/upload", { method: "POST", body: form });

    await expect(parseTransientPhotoMultipart(request)).rejects.toMatchObject({
      code: "unexpected_field",
    });
  });
});
