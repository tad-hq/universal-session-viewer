# Project Governance

This document describes the governance model for Universal Session Viewer.

## Overview

Universal Session Viewer uses a **benevolent dictator governance model** with a documented path to meritocratic expansion. As a solo-maintainer project launching to the community, we start with clear, simple decision-making while establishing the foundation for future growth.

## Roles

### Contributors

Anyone who contributes to the project in any way:

- Submitting bug reports or feature requests
- Contributing code, documentation, or tests
- Helping others in discussions or issues
- Providing feedback on proposals

**How to become a contributor**: Submit your first contribution! All contributions are valued.

### Committers

Trusted contributors with write access to the repository:

- Can merge pull requests
- Can triage and close issues
- Expected to review contributions from others
- Should be active in the community

**How to become a committer**:

1. Make multiple quality contributions over 2+ months
2. Demonstrate understanding of project architecture and values
3. Show consistent engagement with the community
4. Be nominated by an existing maintainer
5. Receive approval from majority of maintainers

### Maintainers

Project stewards responsible for the overall health and direction:

- All committer responsibilities
- Can make decisions about project direction
- Can add/remove committers and maintainers
- Responsible for releases
- Final authority on technical decisions

**How to become a maintainer**:

1. Serve as an active committer for 6+ months
2. Demonstrate deep technical knowledge of the codebase
3. Show leadership in guiding contributors
4. Be nominated by an existing maintainer
5. Receive unanimous approval from all maintainers

## Current Team

### Maintainers

| Name          | GitHub                                     | Focus Area          |
| ------------- | ------------------------------------------ | ------------------- |
| Tad Schnitzer | [@tad-hq](https://github.com/tadschnitzer) | Founding Maintainer |

### Committers

_Committers will be added as the community grows._

## Decision-Making Process

### Day-to-Day Decisions

- Any maintainer can make routine decisions (merging PRs, closing issues)
- Maintainers should use good judgment and seek input when unsure
- Reversible decisions can be made quickly; important decisions need discussion

### Significant Decisions

For significant changes (architecture, breaking changes, new features), we use a **lazy consensus** process:

1. **Proposal**: Open a GitHub Discussion or Issue describing the change
2. **Discussion Period**: Allow 7 days for community feedback
3. **Consensus**: If no maintainer objects, the proposal passes
4. **Objection Handling**: If a maintainer objects, discuss until resolved
5. **Final Authority**: If consensus cannot be reached, maintainers vote (majority wins)

### What Requires Discussion

- Breaking changes to public API
- Major architectural changes
- New dependencies
- Deprecation of features
- Changes to governance

### What Can Be Decided Quickly

- Bug fixes
- Documentation improvements
- Minor feature additions
- Dependency updates (non-breaking)
- Code style changes

## Feature Proposals

### For Contributors

1. **Search existing issues** to avoid duplicates
2. **Open a Discussion** in the "Ideas" category for early feedback
3. **Create an Issue** once the idea has community support
4. **Submit a PR** linking to the issue

### For Maintainers Reviewing Proposals

1. **Acknowledge quickly**: Respond within 3 business days
2. **Be constructive**: If declining, explain why
3. **Suggest alternatives**: Point to workarounds or related features
4. **Label appropriately**: Use `needs-discussion`, `approved`, or `wontfix`

## Breaking Changes Policy

We follow [Semantic Versioning](https://semver.org/):

- **Major versions** (X.0.0): May contain breaking changes
- **Minor versions** (0.X.0): New features, backward compatible
- **Patch versions** (0.0.X): Bug fixes only

### Before Making Breaking Changes

1. Document the change in a proposal
2. Allow 14-day discussion period
3. Provide migration guide
4. Announce in release notes with prominent warning
5. Consider deprecation period for critical features

### Deprecation Process

1. Mark feature as deprecated with warning
2. Document migration path
3. Keep deprecated feature for at least 2 minor versions
4. Remove in next major version

## Conflict Resolution

We aim to resolve conflicts through discussion and compromise.

### Process

1. **Direct Discussion**: Parties discuss the issue directly
2. **Maintainer Mediation**: A neutral maintainer facilitates discussion
3. **Maintainer Vote**: If needed, maintainers vote (majority wins)
4. **Cooling Off**: For heated conflicts, take a 48-hour break before deciding

### Code of Conduct

All participants must follow GitHub's Community Guidelines and maintain respectful, professional communication. Governance disputes that violate community standards will be addressed through appropriate channels.

## Changes to Governance

This governance document may be changed through the significant decision process described above. Changes require:

1. A pull request modifying this document
2. 14-day discussion period
3. Approval from all maintainers

## License

Governance decisions do not affect the project's MIT license. All contributions remain under MIT.

---

## Questions?

- Open a [Discussion](https://github.com/tadschnitzer/universal-session-viewer/discussions) for governance questions
- Contact maintainers directly for sensitive matters
