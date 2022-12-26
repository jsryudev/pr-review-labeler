# Pull Request Review Labeler
Automatically label pull requests based on approved review.
If the target number of reviews is not reached, `label-to-be-removed` is added again.

## Create Workflow
Create a workflow (eg: .github/workflows/labeler.yml see Creating a Workflow file) to utilize the labeler action with content:

```yml
on:
  pull_request:
    types: [synchronize]
  pull_request_review:
    types: [submitted]

jobs:
  labeler:
    runs-on: ubuntu-latest
    steps:
    - uses: jsryudev/pr-review-labeler@v0.2.1
      with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          target-approved-count: 1
          label-to-be-added: 'Accepted'
          label-to-be-removed: 'In Review'
```

## Inputs
Various inputs are defined in [`action.yml`](action.yml)

| Name | Description | Default | Required |
| - | - | - | - |
| `repo-token` | Token to use to authorize label changes. Typically the GITHUB_TOKEN secret | N/A | N/A |
| `target-approved-count` | The target approved review count | 2 | Y |
| `label-to-be-added` | The GitHub label to be added when `target-approved-count` is reached | None | Y |
| `label-to-be-removed` | The GitHub label to be removed when `target-approved-count` is reached | None | N |
