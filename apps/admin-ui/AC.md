# URL Shortener
Hello fellow recruitee, we need your help! We’ve been tasked to create a URL shortener, and
as a new potential to our team we would like your help to create this application. The task is
simple, we want to be able to create a short link for a given URL.
https://some.place.example.com/foo/bar/biz should be shortened to
https://{domain}/abc123

Mock-up
Here's what the simple interface could look like:
 inside a rounded card with a soft shadow and 24px padding.

Shared header :
- App title: “URL Shortener” with a small chain-link icon to the right.
- Sans-serif font, medium weight, clear visual hierarchy.

Initial Form
- Section label (subtle, small): “Form”.
- Body text: “Enter the URL to shorten”.
- Labeled input field:
  - Label: “URL”
  - Empty text field with placeholder hint (e.g., “https://example.com/…”).
- Primary action button below input:
  - Text: “Shorten”
  - Prominent, purple background (#6C63FF or similar), white text.
  - 12px corner radius.
- Generous spacing; simple, neutral grays for borders (#E5E7EB).

Upon form Successful submission:
- Section label (subtle, small): “Success”.
- Body text: “Enter the URL to shorten”.
- Labeled input field:
  - Label: “URL”
  - Filled with “https://example.com/foo/bar/biz”.
  - The “Shorten” button below is present but disabled (muted purple with reduced opacity, no hover).
- Success message below button:
  - Italic, green text: “Success! Here’s your short URL:”
- Short link row:
  - Clickable short URL styled as a link (e.g., “https://short.ly/abc123” with underline).
  - To the right, a small “Copy” button with a clipboard icon; light purple outline, white background.
- Maintain consistent spacing and alignment with the Form card.

Overall visuals:
- Light gray page background (#F3F4F6).
- Cards width ~520–560px each; comfortable gutters between them.
- Inputs: 1px light gray border, 10–12px radius, 44px height.
- Typography: 18–20px for headlines, 16px for body, 12–14px for labels.
- Keep everything crisp, minimal, and accessible (clear focus rings).

Note: bonus points for creativity on the UI side.
Requirements
● Build a React application that allows you enter a URL
● When the form is submitted, return a shortened version of the URL
● Save a record of the shortened URL to a database
● Ensure the slug of the URL (abc123 in the screenshot above) is unique
● When the shortened URL is accessed, redirect to the stored URL
● If an invalid slug is accessed, display a 404 Not Found page
● You should have a list of all URLs saved in the database

Extra Credit
● Add support for accounts so people can view the URLs they have created
● Validate the URL provided is an actual URL
● Display an error message if invalid
● Make it easy to copy the shortened URL to the clipboard
● Allow users to modify the slug of their URL
● Track visits to the shortened URL
● Add rate-limiting to prevent bad-actors
● Add a dashboard showing how popular your URLs are
● Build a Docker image of your application
