import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import * as API from "azure-devops-extension-api";
import { GitServiceIds, IVersionControlRepositoryService } from "azure-devops-extension-api/Git/GitServices";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import {TwoLineTableCell, ITableColumn} from "azure-devops-ui/Table"
import { GitRestClient, GitPullRequest, PullRequestStatus, GitPullRequestSearchCriteria, GitBranchStats } from "azure-devops-extension-api/Git";
import { CommonServiceIds, getClient, IProjectPageService } from "azure-devops-extension-api";
import { showRootComponent } from "../../Common";
import { GitRepository } from "azure-devops-extension-api/Git/Git";
import { fixedColumns,  ITableItem, onSize, renderId, renderCreatedBy,renderDateColumn,renderSourceBranch,renderStatus,renderTargetBranch,WithIcon } from "./TableData";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { Card } from "azure-devops-ui/Card";
import { Table } from "azure-devops-ui/Table";
import { ObservableArray, ObservableValue } from "azure-devops-ui/Core/Observable";
import { announce } from "azure-devops-ui/Core/Util/Accessibility";
import { Toast } from "azure-devops-ui/Toast";
import { ZeroData, ZeroDataActionType } from "azure-devops-ui/ZeroData";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import * as statKeepers from "./statKeepers";
import { Observer } from "azure-devops-ui/Observer";

interface IRepositoryServiceHubContentState {
    repository: GitRepository | null;
    exception: string;
    isToastVisible: boolean;
    isToastFadingOut: boolean;
    foundCompletedPRs: boolean;
    doneLoading:boolean;
}



class RepositoryServiceHubContent extends React.Component<{}, IRepositoryServiceHubContentState> {

    private tableArrayData:ArrayItemProvider<ITableItem>;

    private itemProvider:ObservableArray<ITableItem | ObservableValue<ITableItem | undefined>>;
    private toastRef: React.RefObject<Toast> = React.createRef<Toast>();
    private totalDuration:number;
    private durationDisplayObject:statKeepers.IPRDuration;
    constructor(props: {}) {
        super(props);
        this.tableArrayData=this.getTableItemProvider([]);
        this.itemProvider = new ObservableArray<ITableItem | ObservableValue<ITableItem | undefined>>(this.getTableItemProvider([]).value);
        this.state = { repository: null,   exception: "", isToastFadingOut:false, isToastVisible:false, foundCompletedPRs:true, doneLoading:false};
        this.totalDuration = 0;
        this.durationDisplayObject = {days:0, hours:0, minutes:0, seconds:0, milliseconds:0};
    }

    public async componentDidMount() {
        await SDK.init();
        try{
            const repoSvc = await SDK.getService<IVersionControlRepositoryService>(GitServiceIds.VersionControlRepositoryService);
            var repository = await repoSvc.getCurrentGitRepository();
            var exception = "";       
            var count:number = -1;
            let prTableList:ITableItem[] = []
            let prTableArrayObj:ArrayItemProvider<ITableItem> = this.getTableItemProvider([]);
            
            if(repository)
            {            
                let prList:GitPullRequest[] = await this.retrievePullRequestRowsFromADO(repository.id);
                prTableList = await this.getPullRequestRows(prList);
                prTableArrayObj = this.getTableItemProvider(prTableList);
                count = prTableList.length;
                if(count < 1)
                {
                    this.setState({foundCompletedPRs:false, repository:this.state.repository, isToastFadingOut:false, isToastVisible:false, exception:"", doneLoading:true});
                }
                else
                {
                    let averageOpenTime = this.totalDuration / count;
                    this.durationDisplayObject = statKeepers.getMillisecondsToTime(averageOpenTime);
                    this.setState({doneLoading:true});

                }
            }           
            
        }
            catch(ex)
        {
            exception = " Error Retrieving Pull Requests -- " + ex.toString();
            
        }

        
        
        //this.itemProvider= new ObservableArray<ITableItem | ObservableValue<ITableItem | undefined>>(this.tableArrayData.value);
//        this.setState({
//            repository,  exception, prCount:count, prTableRows: prTableList, prTableArray:prTableArrayObj
//        });
    }

    public AddRowItem(item:ITableItem)
    {
        const asyncRow = new ObservableValue<ITableItem | undefined>(undefined);
        this.itemProvider.push(asyncRow);

        asyncRow.value =
        {
            createdBy: item.createdBy,
            prCreatedDate: item.prCreatedDate,
            prCompleteDate: item.prCompleteDate,
            sourceBranch: item.sourceBranch,
            targetBranch:item.targetBranch,
            id: item.id,
            prOpenTime: item.prOpenTime,
            status:item.status
        };
        announce("Asynchronous row loaded");
    }


    ///
    public async retrievePullRequestRowsFromADO(repositoryId:string): Promise<GitPullRequest[]>
    {
        let searchCriteria: GitPullRequestSearchCriteria = {status:PullRequestStatus.Completed, includeLinks:false, creatorId: "", reviewerId: "", repositoryId: "", sourceRefName: "",targetRefName:"", sourceRepositoryId: ""};
        const client = getClient(GitRestClient);
        let prList = client.getPullRequests(repositoryId, searchCriteria);

        return prList;
    }


    ///
    public getPullRequestRows(prList:GitPullRequest[]): ITableItem[]
    {

        let currentThis = this;
        let rows:ITableItem[] = [];
        try{
            if(prList)
            {        
                prList.forEach(function(value){
                    let reviewerName = "-- no reviewers --"
                    if(value.reviewers.length > 0)
                    {
                        reviewerName = value.reviewers[0].displayName;
                    }                    
                    let PROpenDuration = value.closedDate.valueOf() - value.creationDate.valueOf();
                     
                    let thisPR:ITableItem = {createdBy:value.createdBy.displayName, prCreatedDate:value.creationDate, prCompleteDate:value.closedDate, sourceBranch:value.sourceRefName, targetBranch: value.targetRefName, id: value.pullRequestId.toString(), prOpenTime: PROpenDuration, status:value.status.toString()};
                    currentThis.AddPRDurationToTotalDuration(value);
                    rows.push(thisPR);
                    currentThis.AddRowItem(thisPR);

                    //this.AddRowItem(thisPR);
                    if(currentThis.state.foundCompletedPRs == false)
                    {
                        currentThis.setState({foundCompletedPRs:true, repository:currentThis.state.repository, isToastFadingOut:false, isToastVisible:false, exception:"", doneLoading:true});
                        
                    }
                    if(currentThis.state.doneLoading == false){
                        currentThis.setState({doneLoading:true});
                    }
                });
            }
            else{
                currentThis.setState({foundCompletedPRs:false, repository:currentThis.state.repository, isToastFadingOut:false, isToastVisible:false, exception:"", doneLoading:true});
            }
        }
            catch(ex)
        {
            let exception = " Error Retrieving Pull Requests -- " + ex.toString();
            this.toastError(exception)
        }

        return rows;
    }

    private AddPRDurationToTotalDuration(thisPR:GitPullRequest)
    {

        //get the milliseconds that this PR Was open
        let thisPRDuration = thisPR.closedDate.valueOf() - thisPR.creationDate.valueOf();
        this.totalDuration += thisPRDuration;
    }

    public async GetGitAPIClient(repositoryID:string)
    {
        if(repositoryID)
        {            
            let searchCriteria: GitPullRequestSearchCriteria = {status:PullRequestStatus.Completed, includeLinks:true, creatorId:"", reviewerId: "", repositoryId: repositoryID, sourceRefName: "",targetRefName:"", sourceRepositoryId: repositoryID};
            let prList: GitPullRequest[] = await API.getClient(GitRestClient).getPullRequests(repositoryID, searchCriteria);

        }
    }

    public getTableItemProvider(prRows:ITableItem[]):ArrayItemProvider<ITableItem>
    {
            return new ArrayItemProvider<ITableItem>(
                prRows.map((item: ITableItem) => {
                const newItem = Object.assign({}, item);                
                return newItem;
            })
        );
    }

    private toastError(toastText:string)
    {
        this.setState({isToastVisible:true, isToastFadingOut:false, exception:toastText,repository:this.state.repository})
    }


    public render(): JSX.Element {
        let isToastVisible = this.state.isToastVisible;
        let foundCompletedPRs = this.state.foundCompletedPRs;
        let doneLoading = this.state.doneLoading;

        if(doneLoading)
        {

            if(!foundCompletedPRs)
            {
                return(
                    <Page className="sample-hub flex-grow">                
                    <Header title="Repository PR Stats" titleSize={TitleSize.Large} />
    
                    <ZeroData
                    primaryText="No Completed Pull Requests found in this Repository"
                    secondaryText={
                        <span>
                           This report is designed to give you stats and information about the Pull Request completions in your repository, it will begin providing data as you begin completing Pull Requests in this repository
                        </span>
                    }
                    imageAltText="Bars"
                    imagePath={"./emptyPRList.png"}
                    
                    />
                    </Page>
                );
            }
            else
            {
                return(

                    <Page className="flex-grow prinfo-hub">                
                    <Header title="Repository PR Stats" titleSize={TitleSize.Large} />
                    <div className="flex-row">
                        <div className="flex-column">
                        <Card className="flex-grow" titleProps={{ text: "Average Time Pull Requsts are Open" }}>
                            <div className="flex-row" style={{ flexWrap: "wrap" }}>                                
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={1}>
                                        <div className="body-m secondary-text">Days</div>
                                        <div className="body-m primary-text">{this.durationDisplayObject.days.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={2}>
                                        <div className="body-m secondary-text">Hours</div>
                                        <div className="body-m primary-text">{this.durationDisplayObject.hours.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={3}>
                                        <div className="body-m secondary-text">Minutes</div>
                                        <div className="body-m primary-text">{this.durationDisplayObject.minutes.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={1}>
                                        <div className="body-m secondary-text">Seconds</div>
                                        <div className="body-m primary-text">{this.durationDisplayObject.seconds.toString()}</div>
                                    </div>                        
                            </div>
                        </Card>
                        </div>
                        <div className="flex-column">
                        <Card className="flex-grow" titleProps={{ text: "Average Time Pull Requsts are Open" }}>
                            <div className="flex-row" style={{ flexWrap: "wrap" }}>                                
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={1}>
                                        <div className="body-m secondary-text">Days</div>
                                        <div className="body-m primary-text">{this.durationDisplayObject.days.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={2}>
                                        <div className="body-m secondary-text">Hours</div>
                                        <div className="body-m primary-text">{this.durationDisplayObject.hours.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={3}>
                                        <div className="body-m secondary-text">Minutes</div>
                                        <div className="body-m primary-text">{this.durationDisplayObject.minutes.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={1}>
                                        <div className="body-m secondary-text">Seconds</div>
                                        <div className="body-m primary-text">{this.durationDisplayObject.seconds.toString()}</div>
                                    </div>                        
                            </div>
                        </Card>
                        </div>
                    </div>
                    <Card className="flex-row bolt-table-card">
                        <Table className="flex-cell" ariaLabel="Table of Pull Requests" columns={fixedColumns} itemProvider={this.itemProvider} role="table" />
                    </Card>
                    {isToastVisible && (
                    <Toast
                        ref={this.toastRef}
                        message={this.state.exception}
                        callToAction="OK"
                        onCallToActionClick={() => {this.setState({isToastFadingOut:true, isToastVisible:false,exception:"",repository:this.state.repository})}}
                        />
                    )}
                    </Page>
                );
            }
       
        }
        else { //else not done loading, so show spinner
            return(                      
                <Page className="flex-grow">                    
                        <Header title="Repository PR Stats" titleSize={TitleSize.Large} />
                        <Card className="flex-grow flex-center bolt-table-card" contentProps={{ contentPadding: true }}>                            
                            <div className="flex-cell">
                                <Spinner label="Loading ..." size={SpinnerSize.large} />
                            </div>          
                        </Card>
                    </Page>
            );

        }
    }
}

showRootComponent(<RepositoryServiceHubContent />);