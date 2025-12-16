# DOCX to Pages Tool

A tool for converting DOCX files into multiple AEM Edge Delivery Services pages.

## Overview

This tool allows you to upload a DOCX file and automatically create multiple pages from it. The tool uses H1 headings in the document to separate pages - each H1 heading becomes a new page.

## Usage

Access the tool via:
```
https://da.live/app/{org}/{repo}/tools/docx-to-pages/docx-to-pages
```

Or locally:
```
http://localhost:3000/tools/docx-to-pages/docx-to-pages
```

## How It Works

1. **Upload DOCX File**: Select a `.docx` file from your computer
2. **Process File**: Click "Process File" to parse the document
3. **Review Pages**: The tool will show you all pages it found (based on H1 headings)
4. **Create Pages**: Click "Create Pages" to create all pages in your repository

## Document Structure

For best results, structure your DOCX document as follows:

- **H1 headings** = New pages (page title)
- **H2-H6 headings** = Section headings within pages
- **Paragraphs** = Regular content
- **Lists** = Bulleted or numbered lists
- **Tables** = Data tables

### Example Structure

```
# Page One Title
Content for page one...

## Section Heading
More content...

# Page Two Title
Content for page two...
```

## Features

- ✅ Automatic page detection based on H1 headings
- ✅ Converts paragraphs, headings, lists, and tables
- ✅ Generates SEO-friendly URLs from page titles
- ✅ Creates markdown files compatible with AEM Edge Delivery Services
- ✅ Preview pages before creation

## Technical Details

- Uses [mammoth.js](https://github.com/mikejones/mammoth) for DOCX parsing
- Converts DOCX content to HTML, then to AEM-compatible markdown
- Creates pages via the DA API (`admin.da.live/source`)
- Pages are created in the `/content` directory by default (configurable)

## Limitations

- Only processes `.docx` files (not `.doc`)
- Pages are separated by H1 headings only
- Complex formatting may not be perfectly preserved
- Images in DOCX files are not currently extracted

