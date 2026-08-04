#!/bin/bash
# Update all HTML files for accessibility

files=(
  "site/about.html"
  "site/diagnosis.html"
  "site/early-intervention.html"
  "site/glossary.html"
  "site/paying-for-care.html"
  "site/qualify.html"
  "site/roys-wisdom.html"
  "site/school-ieps.html"
  "site/states.html"
  "site/therapies.html"
  "site/turning-18.html"
)

for file in "${files[@]}"; do
  echo "Processing $file..."
  
  # Add skip link after body tag
  sed -i '/<body>/a\  <a href="#main" class="skip-link">Skip to content</a>' "$file"
  
  # Add id and tabindex to main
  sed -i 's/<main>/<main id="main" tabindex="-1">/' "$file"
  
  # Change first h1 after main/article to h2
  sed -i '/<main id="main"/,/<\/main>/ { /^[[:space:]]*<h1>/{ s/<h1>/<h2>/; s/<\/h1>/<\/h2>/; }; }' "$file"
  
  # Update admin links
  sed -i 's/<a href="\/admin\/" style="color: #999; text-decoration: none; font-size: 0.9em;">Admin<\/a>/<a href="\/admin\/" class="admin-link">Admin<\/a>/g' "$file"
done

echo "Done!"
