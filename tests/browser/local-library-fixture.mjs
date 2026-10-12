import {test} from '@playwright/test';
// Existing cooking/theme tests exercise local state independently of the shared
// development cloud. Real cloud behavior is covered in sync.spec.mjs.
test.beforeEach(async({page})=>{
  await page.route('**/api/library**',route=>route.fulfill({status:503,json:{error:'Cloud unavailable in local cooking tests.'}}));
});
