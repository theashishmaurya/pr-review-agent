// Adapters barrel export

export { VCSAdapter } from './vcs/base';
export { GitHubAdapter, createGitHubAdapter } from './vcs/github';
export { AzureDevOpsAdapter } from './vcs/azure-devops';

export { TicketAdapter } from './ticket/base';
export { JiraAdapter } from './ticket/jira';
export { LinearAdapter } from './ticket/linear';