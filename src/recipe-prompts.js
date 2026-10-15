// The preparation text comes from AI_RECIPE_GUIDE.md during the build, so
// ChatGPT's format response, the public guide and copied prompts stay aligned.
export function createChatGPTPrompt(preparationPrompt,record) {
  const action=record
    ?`Use Cookstep to read my recipe ${JSON.stringify(record.recipe.title)} (ID: ${record.id}) and apply the changes I describe. Preserve its stable ID, other content and images.`
    :'Use Cookstep to add a recipe directly to my library from the source I provide.';
  return `${action}\n\nRead get_recipe_format, including its full preparationGuide, format and example, before constructing the manifest. ${preparationPrompt}\n\nFind source image URLs and use import_recipe_image for the original photos; prefer upload_recipe_image with its native file parameter for original supplied or generated images, preserving their resolution and quality. A direct HTTPS url or original base64 bytes is a fallback; supply exactly one input. Never invent file references, pass local paths as URLs, or shrink/recompress images to fit a tool call. If a temporary link expires, attach the original image again and retry with a fresh reference. Attach the returned asset keys to the matching image IDs in save_recipe. If an image cannot be imported, disclose the gap. Save the complete recipe directly with expectedRevision from a prior read (null for a new recipe) and a UUID mutationId retained on retries. Validate all references and preserve unchanged images. Report what was saved and any unresolved source gaps.\n\n${record?'My changes':'My recipe'}: `;
}
