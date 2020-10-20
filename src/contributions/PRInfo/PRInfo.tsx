import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import * as API from "azure-devops-extension-api";
import { GitServiceIds, IVersionControlRepositoryService } from "azure-devops-extension-api/Git/GitServices";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import { GitRestClient, GitPullRequest, PullRequestStatus, GitPullRequestSearchCriteria, GitBranchStats } from "azure-devops-extension-api/Git";
import { CommonServiceIds, getClient, IProjectPageService } from "azure-devops-extension-api";
import { showRootComponent } from "../../Common";
import { GitRepository } from "azure-devops-extension-api/Git/Git";

interface IRepositoryServiceHubContentState {
    repository: GitRepository | null;
    exception: string | null;
    prCount: number;
}

class RepositoryServiceHubContent extends React.Component<{}, IRepositoryServiceHubContentState> {
    constructor(props: {}) {
        super(props);
        
        this.state = { repository: null,   exception: null, prCount:-1 };
    }

    public async componentDidMount() {
        await SDK.init();
        const repoSvc = await SDK.getService<IVersionControlRepositoryService>(GitServiceIds.VersionControlRepositoryService);
        var repository = await repoSvc.getCurrentGitRepository();
        var exception = "";       
        var aToken = await SDK.getAccessToken();
        var url = await SDK.getUser
        var count:number = -1;
        try{
            if(repository)
            {            
                let searchCriteria: GitPullRequestSearchCriteria = {status:PullRequestStatus.Completed, includeLinks:true, creatorId: "", reviewerId: "", repositoryId: "", sourceRefName: "",targetRefName:"", sourceRepositoryId: ""};
                const client = getClient(GitRestClient);
                let prList: GitPullRequest[] = await client.getPullRequests(repository.id, searchCriteria);
                count = prList.length;
            }
        }
            catch(ex)
        {
            exception = " Error Retrieving Pull Requests -- " + ex.toString();
        }
        
        this.setState({
            repository,  exception, prCount:count
        });
    }

    public async GetGitAPIClient(repositoryID:string)
    {
        if(repositoryID)
        {            
            let searchCriteria: GitPullRequestSearchCriteria = {status:PullRequestStatus.Completed, includeLinks:true, creatorId:"", reviewerId: "", repositoryId: repositoryID, sourceRefName: "",targetRefName:"", sourceRepositoryId: repositoryID};
            let prList: GitPullRequest[] = await API.getClient(GitRestClient).getPullRequests(repositoryID, searchCriteria);
        }
    }

    public render(): JSX.Element {

        return (
            <Page className="sample-hub flex-grow">

                <Header title="Repository Information Sample Hub"
                    titleSize={TitleSize.Medium} />

                <div style={{marginLeft: 32}}>
                    <h3>ID</h3>
                    {
                        this.state.repository &&
                        <p>{this.state.repository.id}</p>
                    }
                    <h3>Name</h3>
                    {
                        this.state.repository &&
                        <p>{this.state.repository.name}</p>
                    }
                    <h3>URL</h3>
                    {
                        this.state.repository &&
                        <p>{this.state.repository.url}</p>
                    }
                    <h3>Count</h3>
                    {
                        this.state.prCount &&
                        <p>{this.state.prCount}</p>
                    }
                    <h3>Ex</h3>
                    {
                        this.state.exception &&
                        <p>{this.state.exception}</p>
                    }
                </div>
            </Page>
        );
    }
}

showRootComponent(<RepositoryServiceHubContent />);