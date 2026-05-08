// Debug script to check template status and test sending
const ACCESS_TOKEN = "EAAUlPXloMvYBRe2W6xcH6GKZAZCVaEirKaSZCKk1WcvgGjzHZC9EDEYimDRzAa01UcLJ8e6SKLSNspLISOF60AikGgZAZAHM9plN8iyLyvfPHVhuLCDoKTCHW8bGZAu8TYBv7gqexCApVgxZC7pN4yNCur1FJ7J3RoBS9tBQNtF42tOP81x2gzZCzY0ZBtu5vPfBwXWGOSyo1gLZCDRjUH8YkZCj2Cmmpa4f94I4U1tgXWMybC8UFAVS9Xd7MsZBH94XYdbg4c8kE7qE2kZBPIKViLmQ2QusJ5cpAJe1m9Olat";
const WABA_ID = "1468847934646076";
const PHONE_NUMBER_ID = "1029572936908574";

async function checkTemplates() {
  console.log("=== Checking Template Status ===\n");
  
  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${WABA_ID}/message_templates?fields=name,status,quality_score,rejected_reason,category&limit=20`,
      { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
    );
    const data = await res.json();
    
    if (data.error) {
      console.log("API Error:", JSON.stringify(data.error, null, 2));
      return;
    }
    
    if (data.data) {
      console.log(`Found ${data.data.length} templates:\n`);
      data.data.forEach(t => {
        const flag = t.name === 'pentacloud_intro' ? ' <<<< THIS ONE' : '';
        console.log(`  ${t.name}`);
        console.log(`    Status: ${t.status}`);
        console.log(`    Category: ${t.category}`);
        console.log(`    Quality: ${JSON.stringify(t.quality_score)}${flag}`);
        if (t.rejected_reason) console.log(`    REJECTED REASON: ${t.rejected_reason}`);
        console.log('');
      });
    }
  } catch (err) {
    console.error("Error checking templates:", err.message);
  }
}

async function checkPhoneQuality() {
  console.log("\n=== Checking Phone Number Quality ===\n");
  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}?fields=quality_rating,messaging_limit_tier,display_phone_number,verified_name,status`,
      { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
    );
    const data = await res.json();
    console.log("Phone Number Info:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

async function testSendToJunaid() {
  console.log("\n=== Test Send to Junaid (919591488660) ===\n");
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '919591488660',
      type: 'template',
      template: {
        name: 'pentacloud_intro',
        language: { code: 'en_US' },
      },
    };

    const res = await fetch(
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
    
    const data = await res.json();
    console.log(`HTTP Status: ${res.status}`);
    console.log("Response:", JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.log("\n>>> ERROR DETAILS:");
      console.log("  Code:", data.error.code);
      console.log("  Subcode:", data.error.error_subcode);
      console.log("  Message:", data.error.message);
      console.log("  Type:", data.error.type);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

(async () => {
  await checkTemplates();
  await checkPhoneQuality();
  await testSendToJunaid();
})();
