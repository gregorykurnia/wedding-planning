import { expect, test } from "@playwright/test";
import { expectStored, signInAndGoto, uniqueName } from "../helpers";

test("create a folder and upload a file (Cloudinary stubbed)", async ({
  page,
}) => {
  // Every Cloudinary call is answered here; nothing leaves the machine.
  const uploads: string[] = [];
  await page.route("https://api.cloudinary.com/**", async (route) => {
    const request = route.request();
    uploads.push(`${request.method()} ${request.url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        public_id: "test-upload/contract",
        secure_url:
          "https://res.cloudinary.com/test-cloud/raw/upload/v1/test-upload/contract.txt",
        resource_type: "raw",
        format: "txt",
        bytes: 24,
        original_filename: "contract",
      }),
    });
  });

  await signInAndGoto(page, "/old/files");
  await expect(
    page.getByRole("heading", { name: "Wedding Files" }),
  ).toBeVisible();

  // Create a folder and open it.
  const folder = uniqueName("Folder");
  await page.getByRole("button", { name: "New folder" }).first().click();
  const folderDialog = page.getByRole("dialog", { name: "New folder" });
  await expect(folderDialog).toBeVisible();
  await folderDialog.getByLabel("Folder name").fill(folder);
  await folderDialog.getByRole("button", { name: "Save folder" }).click();
  await expect(folderDialog).toBeHidden();
  await page.getByRole("button", { name: folder, exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "File location" }),
  ).toContainText(folder);
  await expect(page.getByText("No files here yet")).toBeVisible();

  // Upload a small file through the file chooser.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload files" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "contract.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Signed contract, 24 bytes"),
  });

  // The details dialog opens with the uploaded name filled in.
  const details = page.getByRole("dialog", { name: "File details" });
  await expect(details).toBeVisible();
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toContain(
    "POST https://api.cloudinary.com/v1_1/test-cloud/auto/upload",
  );
  await expect(details.getByLabel("Name")).toHaveValue("contract.txt");

  const fileName = uniqueName("Contract");
  const description = `Details for ${fileName}`;
  await details.getByLabel("Name").fill(fileName);
  await details.getByLabel("Category").fill("Venue");
  await details.getByLabel("Description").fill(description);
  await details.getByRole("button", { name: "Save details" }).click();
  await expect(details).toBeHidden();

  // The file is listed with its details and links to the stored URL.
  const link = page.getByRole("link", { name: fileName, exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute(
    "href",
    /res\.cloudinary\.com\/test-cloud\/.*contract\.txt$/,
  );
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText("Venue", { exact: true })).toBeVisible();

  // It is stored in the folder, not at the top level.
  await expectStored(
    "weddingFiles",
    (d) => d.name === fileName && d.description === description,
  );
  await page.reload();
  await expect(
    page.getByRole("link", { name: fileName, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: folder, exact: true }).click();
  await expect(
    page.getByRole("link", { name: fileName, exact: true }),
  ).toBeVisible();
});
