// Simulate chatbot response using Gemini API directly
export async function askChatbot(message: string) {
  // In a real implementation, you would use your Gemini API key
  // For now, we'll simulate responses based on common questions
  
  // Load knowledge base (in a real app, this would come from the backend)
  const knowledge = {
    "website_name": "CtrlChecks",
    "product_name": "CtrlChecks",
    "category": "Visual AI Workflow Automation",
    "description": "CtrlChecks lets users visually build workflows to connect apps, automate tasks, and deploy AI-powered automations without coding. It's similar to Zapier or n8n, but AI-native.",
    "core_message": "Build automations that think. Connect anything. Automate everything.",
    "features": [
      "Drag-and-drop workflow builder",
      "300+ app integrations",
      "Built-in AI nodes (GPT, Gemini, custom models)",
      "Deploy workflows as API, chatbot, or scheduled jobs",
      "No-code with optional code support"
    ],
    "target_users": [
      "Business teams (marketing, sales, ops)",
      "Developers",
      "Startups",
      "Enterprises"
    ],
    "pricing": {
      "free": "500 runs/month",
      "pro": "$29/month, 10,000 runs",
      "business": "$99/month, 100,000 runs",
      "enterprise": "Custom pricing"
    },
    "differentiation": [
      "AI-native architecture",
      "Better UI than n8n",
      "More flexible than Zapier",
      "Affordable pricing",
      "Optional self-hosting (Enterprise)"
    ],
    "faqs": [
      {
        "question": "What can I build?",
        "answer": "With CtrlChecks, you can build automations that connect your favorite apps, process data, send notifications, and much more. Examples include lead enrichment workflows, customer onboarding processes, social media posting schedules, and automated reporting systems."
      },
      {
        "question": "How is this different from Zapier or n8n?",
        "answer": "CtrlChecks is AI-native, meaning AI capabilities are built into every workflow node. Our interface is more intuitive than n8n, and we offer more flexibility than Zapier while remaining affordable. We also support deploying workflows as APIs, chatbots, or scheduled jobs."
      },
      {
        "question": "Is there a free plan?",
        "answer": "Yes! Our free plan includes 500 runs per month, which is perfect for getting started and testing workflows."
      },
      {
        "question": "Is coding required?",
        "answer": "Not at all! CtrlChecks is a no-code platform. However, for advanced users, we offer optional code support for custom logic and integrations."
      },
      {
        "question": "What apps are supported?",
        "answer": "We support 300+ popular applications including Google Workspace, Slack, Salesforce, HubSpot, GitHub, and more. We're constantly adding new integrations."
      },
      {
        "question": "Is my data secure?",
        "answer": "Absolutely. We take data security seriously with encryption at rest and in transit. Enterprise plans include additional security features and compliance certifications."
      },
      {
        "question": "How do I get started?",
        "answer": "Simply sign up for a free account! You can start building workflows immediately with our drag-and-drop editor and explore our template library for inspiration."
      }
    ],
    "escalation_triggers": [
      "enterprise pricing",
      "security audits",
      "compliance",
      "custom development",
      "talk to sales"
    ],
    "conversion_goals": [
      "Try free plan",
      "View templates",
      "Watch demo",
      "Sign up"
    ],
    "support_email": "support@ctrlchecks.com",
    "sales_email": "sales@ctrlchecks.com"
  };

  // Check for escalation triggers
  const shouldEscalate = knowledge.escalation_triggers.some((trigger: string) => 
    message.toLowerCase().includes(trigger.toLowerCase())
  );

  if (shouldEscalate) {
    return {
      content: "I'll connect you with our team who can help with that. Please contact our sales team at " + 
      (knowledge.sales_email || "sales@ctrlchecks.com") + 
      " for more information.",
      escalation: true,
      suggestions: []
    };
  }

  // Find matching FAQ
  const matchedFaq = knowledge.faqs.find((faq: any) => 
    faq.question.toLowerCase().includes(message.toLowerCase()) ||
    message.toLowerCase().includes(faq.question.toLowerCase().split(' ')[0].toLowerCase())
  );

  // Generate suggestions based on the question
  let suggestions: string[] = [];
  if (message.toLowerCase().includes('pricing') || message.toLowerCase().includes('plan')) {
    suggestions = ["View all plans", "Try free plan"];
  } else if (message.toLowerCase().includes('build') || message.toLowerCase().includes('create')) {
    suggestions = ["View templates", "Watch demo"];
  } else if (message.toLowerCase().includes('start') || message.toLowerCase().includes('begin')) {
    suggestions = ["Try free plan", "Watch demo", "Sign up"];
  } else if (message.toLowerCase().includes('apps') || message.toLowerCase().includes('integrations')) {
    suggestions = ["View all integrations", "See popular apps"];
  } else if (!matchedFaq) {
    // If no specific FAQ matched, suggest common questions
    suggestions = ["What can I build?", "How is this different from Zapier?", "Is there a free plan?"];
  }

  if (matchedFaq) {
    return {
      content: matchedFaq.answer,
      suggestions
    };
  }

  // Handle specific questions
  if (message.toLowerCase().includes('what is') || message.toLowerCase().includes('what does')) {
    return {
      content: knowledge.description,
      suggestions: ["How is this different from Zapier?", "Is there a free plan?", "View templates"]
    };
  }

  if (message.toLowerCase().includes('features')) {
    return {
      content: `Our key features include: ${knowledge.features.slice(0, 3).join(', ')}, and more.`,
      suggestions: ["Tell me more about AI nodes", "See all features", "View templates"]
    };
  }

  if (message.toLowerCase().includes('pricing') || message.toLowerCase().includes('plans')) {
    return {
      content: `We offer several plans:
- Free: ${knowledge.pricing.free}
- Pro: ${knowledge.pricing.pro}
- Business: ${knowledge.pricing.business}
- Enterprise: ${knowledge.pricing.enterprise}`,
      suggestions: ["Try free plan", "Compare plans", "Contact sales"]
    };
  }

  // Default response
  return {
    content: "I'd be happy to help you learn more about CtrlChecks! Could you please ask a specific question about our platform, features, or pricing?",
    suggestions: ["What can I build?", "How is this different from Zapier?", "Is there a free plan?"]
  };
}