const ACCESS_TOKEN = "EAAUlPXloMvYBRe2W6xcH6GKZAZCVaEirKaSZCKk1WcvgGjzHZC9EDEYimDRzAa01UcLJ8e6SKLSNspLISOF60AikGgZAZAHM9plN8iyLyvfPHVhuLCDoKTCHW8bGZAu8TYBv7gqexCApVgxZC7pN4yNCur1FJ7J3RoBS9tBQNtF42tOP81x2gzZCzY0ZBtu5vPfBwXWGOSyo1gLZCDRjUH8YkZCj2Cmmpa4f94I4U1tgXWMybC8UFAVS9Xd7MsZBH94XYdbg4c8kE7qE2kZBPIKViLmQ2QusJ5cpAJe1m9Olat";
const WABA_ID = "1468847934646076";
const PHONE_NUMBER_ID = "1029572936908574";

async function checkTemplateLanguages() {
  console.log("=== Checking Template Languages ===\n");
  const res = await fetch(
    `https://graph.facebook.com/v25.0/${WABA_ID}/message_templates?fields=name,language,status,components&limit=20`,
    { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
  );
  const data = await res.json();
  data.data.forEach(t => {
    console.log(`  ${t.name} | Language: ${t.language} | Status: ${t.status}`);
  });

  // Now test with the correct language
  const introTemplate = data.data.find(t => t.name === 'pentacloud_intro');
  if (introTemplate) {
    console.log(`\n=== Test Send with correct language: ${introTemplate.language} ===\n`);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '919591488660',
      type: 'template',
      template: {
        name: 'pentacloud_intro',
        language: { code: introTemplate.language },
      },
    };
    const sendRes = await fetch(
      `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    const sendData = await sendRes.json();
    console.log(`HTTP Status: ${sendRes.status}`);
    console.log("Response:", JSON.stringify(sendData, null, 2));
  }
}

checkTemplateLanguages().catch(console.error);
