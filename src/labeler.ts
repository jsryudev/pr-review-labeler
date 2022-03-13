import * as core from '@actions/core';
import * as github from '@actions/github';

import { getInputAsInt, Inputs, States } from './utils';

type ClientType = ReturnType<typeof github.getOctokit>;

export async function run() {
  try {
    const token = core.getInput(Inputs.RepoToken, { required: true });
    const riviewerCount =
      getInputAsInt(Inputs.TargetApprovedCount, { required: true }) || 2;
    const labelToBeAdded = core.getInput(Inputs.LabelToBeAdded, {
      required: true
    });
    const labelToBeRemoved = core.getInput(Inputs.LabelToBeRemoved, {
      required: false
    });

    const client = github.getOctokit(token);

    const prNumber = getPrNumber();
    if (!prNumber) {
      console.log('Could not get pull request number from context, exiting');
      return;
    }

    const { data: pullRequest } = await client.rest.pulls.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber
    });

    if (pullRequest.state !== States.Open) {
      console.log('Pull request is not open, exiting');
      return;
    }

    if (pullRequest.labels.find(l => l.name === labelToBeAdded)) {
      console.log('Pull request already has label, exiting');
      return;
    }

    const approvedReviews = await getReviews(client, prNumber, States.APPROVED);

    if (approvedReviews.length >= riviewerCount) {
      await addLabels(client, prNumber, [labelToBeAdded]);

      if (labelToBeRemoved) {
        if (pullRequest.labels.find(l => l.name === labelToBeRemoved)) {
          await removeLabels(client, prNumber, [labelToBeRemoved]);
        }
      }
    }
  } catch (error) {
    core.error(error);

    core.setFailed(error.message);
  }
}

function getPrNumber(): number | undefined {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    return undefined;
  }

  return pullRequest.number;
}

async function getReviews(
  client: ClientType,
  prNumber: number,
  state?: States
): Promise<unknown[]> {
  const iterator = client.paginate.iterator(client.rest.pulls.listReviews, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: prNumber
  });

  const reviews: unknown[] = [];

  for await (const { data: review } of iterator) {
    const targetReviews = review.filter(
      review => review.state === state || States.APPROVED
    );
    reviews.push(...targetReviews);
  }

  return reviews;
}

async function addLabels(
  client: ClientType,
  prNumber: number,
  labels: string[]
) {
  await client.rest.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: prNumber,
    labels: labels
  });
}

async function removeLabels(
  client: ClientType,
  prNumber: number,
  labels: string[]
) {
  await Promise.all(
    labels.map(label =>
      client.rest.issues.removeLabel({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: prNumber,
        name: label
      })
    )
  );
}
