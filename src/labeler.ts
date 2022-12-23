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

    const head = pullRequest.head.sha;

    console.log(`Head SHA for Pull Reqeust: ${head}`);

    if (pullRequest.state !== States.Open) {
      console.log('Pull Request is not open, exiting');
      return;
    }

    const approvedReviews = await getApprovedReviews(client, prNumber, head);

    if (approvedReviews.length >= riviewerCount) {
      await addLabels(client, prNumber, [labelToBeAdded]);

      if (labelToBeRemoved) {
        if (pullRequest.labels.find(l => l.name === labelToBeRemoved)) {
          await removeLabels(client, prNumber, [labelToBeRemoved]);
        }
      }
    } else {
      await addLabels(client, prNumber, [labelToBeRemoved]);

      if (labelToBeAdded) {
        if (pullRequest.labels.find(l => l.name === labelToBeAdded)) {
          await removeLabels(client, prNumber, [labelToBeAdded]);
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

async function getApprovedReviews(
  client: ClientType,
  prNumber: number,
  headSHA: string
): Promise<unknown[]> {
  const iterator = client.paginate.iterator(client.rest.pulls.listReviews, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: prNumber
  });

  const reviews: unknown[] = [];
  const reviewers: unknown[] = [];

  for await (const { data: r } of iterator) {
    const targetReviews = r
      .filter(review => review.commit_id === headSHA)
      .filter(review => review.state === States.APPROVED)
      .filter(review => !reviewers.includes(review.user?.id));

    const targetReviewers = targetReviews
      .filter(review => !!review.user?.id)
      .map(r => r.id);

    reviews.push(...targetReviewers);
    reviews.push(...targetReviews);
  }

  console.log(`found ${reviews.length} reviews`);

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
