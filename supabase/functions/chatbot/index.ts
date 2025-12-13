import { serve } from "https://deno.land/std/http/server.ts";

let knowledge: any = {};

// Load knowledge file ONCE (safe)
try {
  const knowledgeText = await Deno.readTextFile("./website_knowledge.json");
  knowledge = JSON.parse(knowledgeText);
} catch {
  knowledge = {};
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { message } = await req.json();

  if (!message) {
    return new Response(
      JSON.stringify({ error: "Message is required" }),
      { status: 400 }
    );
  }

  // Check if we need to escalate
  const shouldEscalate = knowledge.escalation_triggers?.some((trigger: string) => 
    message.toLowerCase().includes(trigger.toLowerCase())
  );

  if (shouldEscalate) {
    return new Response(
      JSON.stringify({ 
        content: "I'll connect you with our team who can help with that. Please contact our sales team at " + 
        (knowledge.sales_email || "sales@ctrlchecks.com") + 
        " for more information.",
        escalation: true
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Create a structured prompt with the knowledge base
  const systemPrompt = `
You are a friendly and professional website chatbot for ${knowledge.website_name || "our platform"}.

CORE INFORMATION:
Product Name: ${knowledge.product_name || ""}
Category: ${knowledge.category || ""}
Description: ${knowledge.description || ""}
Core Message: ${knowledge.core_message || ""}

KEY FEATURES:
${(knowledge.features || []).map((feature: string, i: number) => `${i+1}. ${feature}`).join('\n')}

PRICING PLANS:
Free: ${knowledge.pricing?.free || ""}
Pro: ${knowledge.pricing?.pro || ""}
Business: ${knowledge.pricing?.business || ""}
Enterprise: ${knowledge.pricing?.enterprise || ""}

DIFFERENTIATION:
${(knowledge.differentiation || []).map((diff: string, i: number) => `${i+1}. ${diff}`).join('\n')}

RULES FOR RESPONSES:
- Be friendly, professional, helpful but not pushy
- Use clear, beginner-friendly language
- Keep responses concise with short paragraphs
- Answer ONLY using the information provided above
- Do NOT guess or use outside knowledge
- Do NOT repeat information
- Include at most one follow-up question
- If you don't have the exact information, use this fallback response:
  "Sorry, I don't have that information right now. Please contact our team or check the website."

FAQs:
${(knowledge.faqs || []).map((faq: any) => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')}
`;

  try {
    // Call Gemini API
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + Deno.env.get("GEMINI_API_KEY"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { text: `User question: ${message}` }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the response content
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I'm having trouble responding right now. Please try again.";

    // Check if we should suggest conversion actions
    const conversionResponse = {
      content,
      suggestions: [] as string[]
    };

    // Add relevant suggestions based on the conversation
    if (message.toLowerCase().includes('pricing') || message.toLowerCase().includes('plan')) {
      conversionResponse.suggestions = ["View all plans", "Try free plan"];
    } else if (message.toLowerCase().includes('build') || message.toLowerCase().includes('create')) {
      conversionResponse.suggestions = ["View templates", "Watch demo"];
    } else if (message.toLowerCase().includes('start') || message.toLowerCase().includes('begin')) {
      conversionResponse.suggestions = ["Try free plan", "Watch demo", "Sign up"];
    }

    return new Response(
      JSON.stringify(conversionResponse),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Chatbot error:", error);
    
    // Return a more helpful error message
    return new Response(
      JSON.stringify({ 
        content: "Sorry, I'm having trouble responding right now. Please try again or contact our support team.",
        suggestions: []
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});