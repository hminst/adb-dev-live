# Accordion Block

An accessible accordion component that allows authors to create expandable content sections with customizable behavior.

## Author Guide

### Basic Usage

Create an accordion by adding a table with two columns:
1. **First column**: The title/header (what users click to expand)
2. **Second column**: The content that expands/collapses

**Example:**

```
| Accordion |
|-----------|
| **What is Edge Delivery Services?** | Edge Delivery Services is Adobe's modern web platform that delivers lightning-fast websites. Built on a unique architecture that combines the flexibility of modern development with the power of Adobe Experience Manager. |
| **How does the authoring process work?** | Content is authored in familiar tools like Google Docs, Microsoft Word, or SharePoint. Authors work in the tools they already know, while the platform automatically transforms content into high-performance web pages. No complex training required. |
| **Why choose Edge Delivery?** | Edge Delivery provides unmatched performance with consistent 100 PageSpeed scores, instant publishing, and real-time previews. Authors can see changes immediately, and websites load in milliseconds. |
```

### Content Guidelines

**Title Column (Column 1):**
- Use **bold text** or headings (H3-H6) to format the title
- Keep titles concise and descriptive (2-10 words recommended)
- Make titles actionable questions or clear topics

**Content Column (Column 2):**
- Can include any rich content: paragraphs, lists, links, images
- Use proper formatting for readability
- Break long content into multiple paragraphs
- Add links where relevant

### Variants

#### Default Accordion (Multi-Open)
```
| Accordion |
|-----------|
| **First Item** | Content here... |
| **Second Item** | More content... |
```
- Multiple items can be open at the same time
- Users can compare content across different sections
- Good for: FAQs where users might want to reference multiple answers

#### Single-Open Accordion (Exclusive)
```
| Accordion (Single-Open) |
|-------------------------|
| **First Item** | Content here... |
| **Second Item** | More content... |
```
- Only one item can be open at a time
- Opening a new item automatically closes the previous one
- Good for: Step-by-step guides, wizard-like flows, focusing user attention

#### Bordered Accordion
```
| Accordion (Bordered) |
|----------------------|
| **First Item** | Content here... |
| **Second Item** | More content... |
```
- Visual style with borders around each item
- Creates clear separation between items
- Good for: Dense content, multiple accordions on one page

#### Minimal Accordion
```
| Accordion (Minimal) |
|---------------------|
| **First Item** | Content here... |
| **Second Item** | More content... |
```
- Clean style without extra borders
- More subtle visual treatment
- Good for: Simple content, minimalist designs

### Best Practices

**Do:**
- ✅ Use descriptive, scannable titles
- ✅ Keep content organized within each section
- ✅ Use bold or heading formatting for titles
- ✅ Include 3-8 items per accordion (optimal)
- ✅ Test with real content to ensure good readability
- ✅ Use single-open mode for sequential content

**Don't:**
- ❌ Nest accordions inside accordions
- ❌ Use extremely long titles (causes wrapping issues)
- ❌ Leave either column empty
- ❌ Put critical information only in closed accordions
- ❌ Use more than 15-20 items (consider breaking into multiple sections)

### Accessibility

This accordion block is fully accessible:
- ✅ Keyboard navigation (Tab, Enter, Space keys)
- ✅ Screen reader support with proper ARIA labels
- ✅ Clear focus indicators
- ✅ Semantic HTML structure
- ✅ Touch-friendly tap targets (44px minimum)

### Common Use Cases

**FAQs (Frequently Asked Questions)**
```
| Accordion |
|-----------|
| **How do I reset my password?** | Visit the login page and click "Forgot Password"... |
| **What payment methods do you accept?** | We accept all major credit cards, PayPal... |
| **How long does shipping take?** | Standard shipping takes 5-7 business days... |
```

**Product Features**
```
| Accordion (Single-Open) |
|-------------------------|
| **Performance** | Lightning-fast load times with 100 PageSpeed scores... |
| **Scalability** | Handles millions of page views effortlessly... |
| **Security** | Enterprise-grade security with regular audits... |
```

**Step-by-Step Instructions**
```
| Accordion (Single-Open) |
|-------------------------|
| **Step 1: Create Account** | Navigate to the sign-up page and enter your details... |
| **Step 2: Verify Email** | Check your inbox for the verification email... |
| **Step 3: Complete Profile** | Fill in your profile information to get started... |
```

**Documentation Sections**
```
| Accordion |
|-----------|
| **Getting Started** | Follow this guide to set up your first project... |
| **Configuration Options** | Learn about all available configuration settings... |
| **Advanced Topics** | Explore advanced features for power users... |
```

### Tips for Great Accordions

1. **Start with the most important content first** - Users often only open the first few items
2. **Use parallel structure** - Keep title formats consistent (all questions, all statements, etc.)
3. **Preview before publishing** - Always test the accordion with your actual content
4. **Consider mobile users** - Accordions are especially useful on mobile devices
5. **Don't hide critical info** - Important content should be visible without interaction when possible

### Examples in Action

See the accordion block in action at: `/accordion`

---

## Developer Notes

### Implementation Details

- **JavaScript**: `accordion.js` - Handles decoration, event listeners, and state management
- **CSS**: `accordion.css` - Responsive styles with mobile-first approach
- **Animation**: Max-height transitions with opacity fade (0.25s)
- **Accessibility**: Full ARIA implementation with proper button semantics

### Technical Features

- Collection-based content model (rows = items)
- Semantic button elements for keyboard access
- ARIA attributes: `aria-expanded`, `aria-controls`, `aria-labelledby`
- Focus management with visible focus indicators
- Touch-friendly with 44px minimum touch targets
- Mobile-first responsive design (600px breakpoint)
- Smooth animations with hardware acceleration

### CSS Classes

- `.accordion` - Main container
- `.accordion-item` - Individual accordion item wrapper
- `.accordion-header` - Header container
- `.accordion-button` - Clickable button element
- `.accordion-panel` - Expandable content container
- `.accordion-content` - Content wrapper with padding
- `.is-open` - State class for open items

### Variants (via block classes)

- `.single-open` - Exclusive open behavior
- `.bordered` - Visual bordered style
- `.minimal` - Minimal clean style

