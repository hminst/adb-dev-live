# Accordion Block - Author Guide

An accordion allows you to create expandable content sections. Users click on a title to reveal or hide the content underneath.

---

## How to Create an Accordion

Create a table with the block name "Accordion" and two columns:

1. **First column**: The title (what users click)
2. **Second column**: The content that expands

### Basic Example

| Accordion | |
|-----------|---|
| **What is Edge Delivery Services?** | Edge Delivery Services is Adobe's modern web platform that delivers lightning-fast websites. Built on a unique architecture that combines the flexibility of modern development with the power of Adobe Experience Manager. |
| **How does the authoring process work?** | Content is authored in familiar tools like Google Docs, Microsoft Word, or SharePoint. Authors work in the tools they already know, while the platform automatically transforms content into high-performance web pages. |
| **Why choose Edge Delivery?** | Edge Delivery provides unmatched performance with consistent 100 PageSpeed scores, instant publishing, and real-time previews. |

---

## Accordion Variants

### Default Accordion

Use this when you want multiple items to stay open at the same time.

| Accordion | |
|-----------|---|
| **First Question** | Answer to the first question goes here. |
| **Second Question** | Answer to the second question goes here. |
| **Third Question** | Answer to the third question goes here. |

### Single-Open Accordion

Use this when you want only one item open at a time. Opening a new item automatically closes the previous one.

| Accordion (Single-Open) | |
|-------------------------|---|
| **Step 1: Setup** | Complete the initial setup process. |
| **Step 2: Configuration** | Configure your settings. |
| **Step 3: Launch** | Launch your project. |

### Bordered Accordion

Adds visible borders around each item for better visual separation.

| Accordion (Bordered) | |
|----------------------|---|
| **Feature One** | Description of feature one. |
| **Feature Two** | Description of feature two. |

### Minimal Accordion

Clean style with minimal visual elements.

| Accordion (Minimal) | |
|---------------------|---|
| **Topic One** | Information about topic one. |
| **Topic Two** | Information about topic two. |

---

## Formatting Your Content

### Title Column (First Column)

- Use **bold text** to make titles stand out
- Keep titles short and clear (2-10 words)
- Make titles descriptive so users know what's inside

**Good Examples:**
- **How do I reset my password?**
- **What payment methods are accepted?**
- **Shipping and delivery information**

**Avoid:**
- Very long titles that wrap multiple lines
- Vague titles like "Click here" or "More info"

### Content Column (Second Column)

You can include:
- Paragraphs of text
- Bullet lists
- Numbered lists
- Links
- Images
- Bold and italic formatting

**Example with rich content:**

| Accordion | |
|-----------|---|
| **Getting Started** | Follow these steps to begin: 1. Create your account 2. Verify your email 3. Complete your profile. Visit our [help center](https://example.com/help) for more information. |

---

## Best Practices

### Do This ✓

- Use clear, descriptive titles
- Keep content organized and scannable
- Format titles with bold text
- Include 3-8 items per accordion
- Use single-open for step-by-step guides
- Test your accordion with real content

### Don't Do This ✗

- Don't nest accordions inside accordions
- Don't use extremely long titles
- Don't leave columns empty
- Don't hide critical information in closed sections
- Don't create more than 20 items (split into multiple sections instead)

---

## Common Uses

### Frequently Asked Questions

| Accordion | |
|-----------|---|
| **How do I reset my password?** | Visit the login page and click "Forgot Password". You'll receive an email with reset instructions. |
| **What payment methods do you accept?** | We accept all major credit cards, PayPal, and bank transfers. |
| **How long does shipping take?** | Standard shipping takes 5-7 business days. Express shipping is available for 2-3 day delivery. |

### Product Features

| Accordion (Single-Open) | |
|-------------------------|---|
| **Performance** | Lightning-fast load times with 100 PageSpeed scores. Built for speed from the ground up. |
| **Scalability** | Handles millions of page views effortlessly. Grows with your business. |
| **Security** | Enterprise-grade security with regular audits and updates. |

### Step-by-Step Instructions

| Accordion (Single-Open) | |
|-------------------------|---|
| **Step 1: Create Account** | Navigate to the sign-up page and enter your details. Choose a strong password. |
| **Step 2: Verify Email** | Check your inbox for the verification email. Click the link to verify. |
| **Step 3: Complete Profile** | Fill in your profile information to get started. Add a profile picture. |

### Documentation Sections

| Accordion | |
|-----------|---|
| **Getting Started** | Follow this guide to set up your first project and understand the basics. |
| **Configuration** | Learn about all available configuration settings and customization options. |
| **Advanced Topics** | Explore advanced features including integrations and custom development. |

---

## Tips for Success

1. **Start with the most important content first** - Users often only open the first few items

2. **Use parallel structure** - Keep title formats consistent:
   - All questions: "How do I...?" "What is...?" "Why should I...?"
   - All statements: "Product features" "Pricing options" "Support resources"

3. **Preview before publishing** - Always test with your actual content to ensure good readability

4. **Consider mobile users** - Accordions save space on mobile devices and improve scrolling

5. **Don't hide critical information** - Important content should be visible without requiring interaction

---

## Accessibility

This accordion is fully accessible:

- Works with keyboard navigation (Tab, Enter, Space keys)
- Compatible with screen readers
- Clear focus indicators for keyboard users
- Touch-friendly for mobile devices
- Meets WCAG accessibility standards

---

## Need Help?

- See live examples at: `/accordion`
- Contact your web team for technical support
- Refer to this guide when creating accordions

---

**Last Updated:** November 2025

