# Source and asset provenance

PharmaFlow uses the user-supplied PharmaLy Next.js template (`pharmalynextjs-10`) as the reference for pharmacy modules and workflows. The reference's documentation identifies it as a ThemeForest/Envato product. Its original source is kept outside this repository; this repository is not a distribution of the original template.

This implementation replaces that template's application structure with a React/Vite frontend, a NestJS API, PostgreSQL persistence and a new visual treatment. Development was assisted by OpenAI Codex. The case study describes the work as a reference-informed rebuild, not an unaided design or an entirely novel workflow.

The visible product illustrations are inline SVG in `apps/web/src/components/ProductImage.tsx`. Branding/favicon and showcase artwork are project-created. The previously copied, unused product PNGs have been excluded from this release. No photographs, reference template files or its original brand assets are distributed. UI icons are from lucide-react (ISC); dependency licenses remain with their respective owners. `package-lock.json` pins dependencies; their packages contain their license notices.

No broad open-source license is granted for this repository. Public source visibility supports portfolio review; copyright owners retain their rights. Do not describe or redistribute the commercial reference template as open source.
