import 'dotenv/config'

async function run() {
  const apiKey = process.env.MODUSIGN_API_KEY
  const email = process.env.MODUSIGN_EMAIL
  const templateId = process.env.MODUSIGN_TEMPLATE_ID_FIXED_TERM || process.env.MODUSIGN_TEMPLATE_ID_STANDARD
  
  if (!apiKey || !email || !templateId) {
    console.log('Missing env vars')
    return
  }
  
  const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64')
  
  const res = await fetch(`https://api.modusign.co.kr/templates/${templateId}`, {
    headers: {
      'Authorization': `Basic ${credentials}`
    }
  })
  
  const data = await res.json()
  console.log(JSON.stringify(data, null, 2))
}

run()
