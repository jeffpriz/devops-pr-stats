import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import * as API from "azure-devops-extension-api";
import { GitServiceIds, IVersionControlRepositoryService } from "azure-devops-extension-api/Git/GitServices";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";
import { GitRestClient, GitPullRequest, PullRequestStatus, GitPullRequestSearchCriteria, GitBranchStats } from "azure-devops-extension-api/Git";
import { CommonServiceIds, getClient } from "azure-devops-extension-api";
import { showRootComponent } from "../../Common";
import { GitRepository, IdentityRefWithVote } from "azure-devops-extension-api/Git/Git";
import {  fixedColumns,  ITableItem } from "./TableData";
import { getPieChartInfo, getStackedBarChartInfo, stackedChartOptions,BarChartSize, getDurationBarChartInfo,getPullRequestsCompletedChartInfo } from "./ChartingInfo";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { Card } from "azure-devops-ui/Card";
import { Table } from "azure-devops-ui/Table";
import { ObservableArray, ObservableValue } from "azure-devops-ui/Core/Observable";
import { Toast } from "azure-devops-ui/Toast";
import { ZeroData, ZeroDataActionType } from "azure-devops-ui/ZeroData";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import * as statKeepers from "./statKeepers";
import { Doughnut, Bar } from 'react-chartjs-2';
import { Dropdown } from "azure-devops-ui/Dropdown";
import { IListBoxItem } from "azure-devops-ui/ListBox";
import { Observer } from "azure-devops-ui/Observer";
import { DropdownSelection } from "azure-devops-ui/Utilities/DropdownSelection";
import { tooltipString } from "azure-devops-ui/Utilities/Date";


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
    private totalDuration:number = 0;
    private durationDisplayObject:statKeepers.IPRDuration;
    private targetBranches:statKeepers.INameCount[] = [];
    private branchDictionary:Map<string, statKeepers.INameCount>;

    private approverList: ObservableValue<statKeepers.IReviewWithVote[]>;
    private approverDictionary:Map<string, statKeepers.IReviewWithVote>;


    private approvalGroupList: statKeepers.IReviewWithVote[] =[];
    private approvalGroupDictionary: Map<string, statKeepers.IReviewWithVote>;
    public readonly noReviewerText:string ="No Reviewer";

    public myBarChartDims:BarChartSize;
    public PRCount:number = 0;
    //private completedDate:Date;
    private readonly TOP500_Selection_ID = "3650";
    private readonly dayMilliseconds:number = ( 24 * 60 * 60 * 1000);
    private completedDate:ObservableValue<Date>;
    private displayText:ObservableValue<string>;
    private rawPRCount:number= 0;
    private dateSelection:DropdownSelection;
    private mondayBeforeEarliestPR:Date = new Date();
    private durationSlices:statKeepers.IDurationSlice[] = [];
    private dateSelectionChoices = [
        { text: "Last 7 Days", id: "7" },
        { text: "Last 14 Days", id: "14" },
        { text: "Last 30 Days", id: "30" },
        { text: "Last 60 Days", id: "60" },
        { text: "Last 90 Days", id: "90" },
        { text: "Top 500 PRs", id: this.TOP500_Selection_ID }

    ];

    constructor(props: {}) {
        super(props);
        this.tableArrayData=this.getTableItemProvider([]);
        this.itemProvider = new ObservableArray<ITableItem | ObservableValue<ITableItem | undefined>>(this.getTableItemProvider([]).value);
        this.state = { repository: null,   exception: "", isToastFadingOut:false, isToastVisible:false, foundCompletedPRs:true, doneLoading:false};        
        this.durationDisplayObject = {days:0, hours:0, minutes:0, seconds:0, milliseconds:0};
        
        this.myBarChartDims = {height:250, width:500};


        
        this.dateSelection = new DropdownSelection();
        this.dateSelection.select(2);
        this.completedDate = new ObservableValue<Date>(this.getDateForSelectionIndex(2));
        this.displayText =  new ObservableValue<string>("Completed Since " + this.completedDate.value.toLocaleDateString());

        this.branchDictionary = new Map<string,statKeepers.INameCount>();
        this.approvalGroupDictionary = new Map<string,statKeepers.IReviewWithVote>();
        this.approverDictionary = new Map<string, statKeepers.IReviewWithVote>();
        this.approverList = new ObservableValue<statKeepers.IReviewWithVote[]>([]);
        this.initCollectionValues()
        
    }
    private initCollectionValues()
    {
        this.totalDuration = 0;
        this.PRCount = 0;
        this.approvalGroupDictionary.clear();
        this.approverDictionary.clear();
        this.branchDictionary.clear();
        this.approverDictionary.set(this.noReviewerText, {name:this.noReviewerText,value:0, notVote:0, voteApprove:0, voteReject:0, voteWait:0});
        this.approverList.value = [];
        this.targetBranches= [];
        this.approvalGroupList= [];        
    }


    private getDateForSelectionIndex(ndx:number):Date
    {
        let dateOffset:number =0;
        if(this.dateSelectionChoices.length >= ndx)
        {
            dateOffset = Number.parseInt(this.dateSelectionChoices[ndx].id);
        }
        let RetDate:Date = new Date(new Date().getTime() - (dateOffset * this.dayMilliseconds));

        return RetDate;
    }

    public async componentDidMount() {
        await SDK.init();
        try{
            const repoSvc = await SDK.getService<IVersionControlRepositoryService>(GitServiceIds.VersionControlRepositoryService);
            const wiSvc = await SDK.getService(CommonServiceIds.LocationService)
            var repository = await repoSvc.getCurrentGitRepository();
            var exception = "";       
            //var count:number = -1;
            let prTableList:ITableItem[] = []
            let prTableArrayObj:ArrayItemProvider<ITableItem> = this.getTableItemProvider([]);
            
            if(repository)
            {            
                this.setState({repository:repository});
                //let prList:GitPullRequest[] = await this.retrievePullRequestRowsFromADO(repository.id);
                await this.LoadData();                
                
                if(this.rawPRCount < 1)
                {
                    this.setState({foundCompletedPRs:false, isToastFadingOut:false, isToastVisible:false, exception:"", doneLoading:true});
                }
                else
                {
                    this.setState({foundCompletedPRs:true, isToastFadingOut:false, isToastVisible:false, exception:"", doneLoading:true});
                }
                
                
            }           
            
        }
        catch(ex)
        {
            exception = " Error Retrieving Pull Requests -- " + ex.toString();
            this.toastError(exception);
            
        }

    }

    public async GetGitAPIClient(repositoryID:string)
    {
        if(repositoryID)
        {            
            let searchCriteria: GitPullRequestSearchCriteria = {status:PullRequestStatus.Completed, includeLinks:true, creatorId:"", reviewerId: "", repositoryId: repositoryID, sourceRefName: "",targetRefName:"", sourceRepositoryId: repositoryID};
            let prList: GitPullRequest[] = await API.getClient(GitRestClient).getPullRequests(repositoryID, searchCriteria);

        }
    }

    private onSelect = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) => {
        this.completedDate.value = new Date((new Date().getTime() - (Number.parseInt(item.id) * this.dayMilliseconds)))
        if(item.id == this.TOP500_Selection_ID)
        {
            this.displayText.value = "Top 500";
        }
        else
        {
            this.displayText.value =  "Completed Since " + this.completedDate.value.toLocaleDateString();
        }
        this.approverList.value = [];
        this.handleDateChange();
    };

    private GetTableDataFunctions(prList:GitPullRequest[]):ArrayItemProvider<ITableItem>
    {
        if(prList)
        {
            let prTableList = this.getPullRequestRows(prList);
            let prTableArrayObj = this.getTableItemProvider(prTableList);
            return prTableArrayObj;
        }
        else {
            this.setState({isToastVisible:true, exception:"The List of Pull Requests was not provided when attempting to build the table objects"});
            return new ArrayItemProvider([]);
        }
    }


    private async LoadData()
    {
        if(this.state.repository)
        {
            let prList:GitPullRequest[] = await this.retrievePullRequestRowsFromADO(this.state.repository.id);
            prList = prList.sort(statKeepers.ComparePRClosedDate);
            let prTableList = await this.getPullRequestRows(prList);
            this.rawPRCount =  prList.length;
            this.GetTableDataFunctions(prList);
            this.AssembleData();
            //this.mondayBeforeEarliestPR = statKeepers.getMondayBeforeEarliestPR(prList);
            this.mondayBeforeEarliestPR = statKeepers.getMondayBeforeEarliestPR(prList);
            this.durationSlices = statKeepers.getPRDurationSlices(prList);
        }
        else
        {
            this.setState({isToastVisible:true, exception:"The Repository ID was not found when attempting to load data!"});
        }
    }

    private async handleDateChange()
    {
        
        this.setState({doneLoading:false});
        if(this.state.repository)
        {            
            this.LoadData();
        }
        this.setState({doneLoading:true});
    }

    private AssembleData()
    {
        try
        {
            let tempapproverList:statKeepers.IReviewWithVote[] = [];
            let averageOpenTime =0;
            if(this.PRCount > 0)
            {
                 averageOpenTime = this.totalDuration / this.PRCount;
            }
        
            
            this.branchDictionary.forEach((thisBranchItem) =>{
                this.targetBranches.push(thisBranchItem);
            });
            this.approverDictionary.forEach((value)=>{
                //we will only put the "No Reviewer" item in if we had a PR with no reviewer
                if(value.name == this.noReviewerText)
                {
                    if(value.value > 0)
                    {
                        tempapproverList.push(value);
                    }

                }
                else {
                    tempapproverList.push(value);
                }
                
            })

            this.approvalGroupDictionary.forEach((value)=>{
                this.approvalGroupList.push(value);
            });

            //sort the lists
            this.approvalGroupList = this.approvalGroupList.sort(statKeepers.CompareReviewWithVoteByValue);
            this.approverList.value = tempapproverList.sort(statKeepers.CompareReviewWithVoteByValue);
            this.targetBranches = this.targetBranches.sort(statKeepers.CompareINameCountByValue);

            this.durationDisplayObject = statKeepers.getMillisecondsToTime(averageOpenTime);
        }
        catch(ex)
        {
            this.toastError("Assembling data: " + ex);
        }
        this.setState({doneLoading:true});
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
            status:item.status,
            reviewerCount: item.reviewerCount
        };
        
    }


    ///
    public async retrievePullRequestRowsFromADO(repositoryId:string): Promise<GitPullRequest[]>
    {
        let searchCriteria: GitPullRequestSearchCriteria = {status:PullRequestStatus.Completed, includeLinks:false, creatorId: "", reviewerId: "", repositoryId: "", sourceRefName: "",targetRefName:"", sourceRepositoryId: ""};
        const client = getClient(GitRestClient);
        let prList = client.getPullRequests(repositoryId, searchCriteria,undefined,undefined,undefined,500);

        return prList;
    }



    ///
    public getPullRequestRows(prList:GitPullRequest[]): ITableItem[]
    {
       
        let rows:ITableItem[] = [];
        try{
            if(prList)
            {        
                this.initCollectionValues();
                prList.forEach((value)=>{
                    if(value.closedDate >= this.completedDate.value)
                    {
                        let reviewerName = "-- no reviewers --"
                        if(value.reviewers.length > 0)
                        {
                            reviewerName = value.reviewers[0].displayName;
                        }                    
                        let PROpenDuration = value.closedDate.valueOf() - value.creationDate.valueOf();
                        
                        let thisPR:ITableItem = {createdBy:value.createdBy.displayName, prCreatedDate:value.creationDate, prCompleteDate:value.closedDate, sourceBranch:value.sourceRefName, targetBranch: value.targetRefName, id: value.pullRequestId.toString(), prOpenTime: PROpenDuration, status:value.status.toString(), reviewerCount:value.reviewers.length};
                        
                        this.AddPRDurationToTotalDuration(value);
                        this.AddPRTargetBranchToStat(value);

                        this.AddPRReviewerToStat(value);

                        rows.push(thisPR);
                        this.AddRowItem(thisPR);

                        //this.AddRowItem(thisPR);
                        if(this.state.foundCompletedPRs == false)
                        {
                            this.setState({foundCompletedPRs:true, repository:this.state.repository, isToastFadingOut:false, isToastVisible:false, exception:"", doneLoading:true});
                            
                        }
                        if(this.state.doneLoading == false){
                            this.setState({doneLoading:true});
                        }
                        this.PRCount +=1;
                    }
                });
            }
            else{
                this.setState({doneLoading:true});
            }
        }
        catch(ex)
        {
            let exception = " Error Retrieving Pull Requests -- " + ex.toString();
            this.toastError("Getting Rows: " + exception);
        }

        return rows;
    }

    private AddPRDurationToTotalDuration(thisPR:GitPullRequest)
    {
        //get the milliseconds that this PR Was open
        let thisPRDuration = thisPR.closedDate.valueOf() - thisPR.creationDate.valueOf();
        this.totalDuration += thisPRDuration;
    }

    private AddPRTargetBranchToStat(thisPR:GitPullRequest)
    {
        let branchnameOnly = thisPR.targetRefName.replace("refs/heads/","")
        let branch = branchnameOnly;
        if (branchnameOnly.split('/').length > 1)
        {
            branch = branchnameOnly.split('/')[0] + "/*";
        }


        if(this.branchDictionary.has(branch))
        {
            let thisref = this.branchDictionary.get(branch);
            if(thisref)
            {
                thisref.value = thisref.value +1;                
            }
            
        }
        else
        {
            this.branchDictionary.set(branch, {name: branch, value:1});
        }
    }

    private AddPRReviewerToStat(thisPR:GitPullRequest)
    {

        if(thisPR.reviewers.length > 0)
        {
            thisPR.reviewers.forEach(value =>{
                if(!value.isContainer)
                {
                    this.AddPRIdentityToStat(value);
                }
                else
                {
                    this.AddPRApprovalGroupToStat(value);
                }
            });
            
        }
        else
        {
            let thisref = this.approverDictionary.get(this.noReviewerText);
            if(thisref)
            {
                thisref.value = thisref.value +1;                
            }
        }
    }

    private AddPRIdentityToStat(thisValue:IdentityRefWithVote)
    {
        let thisID = thisValue.displayName;
        let thisName = thisValue.displayName;
        if(this.approverDictionary.has(thisID))
        {
            let thisApprover = this.approverDictionary.get(thisID);
            if(thisApprover)
            {
                thisApprover.value = thisApprover.value + 1;
                this.AddVoteCount(thisApprover,thisValue.vote);
                this.approverDictionary.set(thisID, thisApprover);            
            }            
        }
        else {
            
            let newVoteStat:statKeepers.IReviewWithVote = {name:thisName, value:1, voteApprove:0, voteReject:0, voteWait:0,notVote:0};
            this.AddVoteCount(newVoteStat, thisValue.vote);
            this.approverDictionary.set(thisID, newVoteStat);
        }
    }

    private AddPRApprovalGroupToStat(thisValue:IdentityRefWithVote)
    {

        let thisID = thisValue.displayName;
        let thisName = thisValue.displayName;
        let nameParts = thisName.split("\\")
        if(nameParts.length = 2)
        {
            thisName = nameParts[1];
        }
        if(this.approvalGroupDictionary.has(thisID))
        {
            thisValue.vote

            let thisApprover = this.approvalGroupDictionary.get(thisID);
            if(thisApprover)
            {
                thisApprover.value = thisApprover.value + 1;
                this.AddVoteCount(thisApprover,thisValue.vote);
                this.approvalGroupDictionary.set(thisID, thisApprover);          
            
            }            
        }
        else {
            let newVoteStat:statKeepers.IReviewWithVote = {name:thisName, value:1, voteApprove:0, voteReject:0, voteWait:0,notVote:0};
            this.AddVoteCount(newVoteStat, thisValue.vote);
            this.approvalGroupDictionary.set(thisID, newVoteStat);
            
        }
    }

    private AddVoteCount(statItem:statKeepers.IReviewWithVote, vote:number )
    {
        if(vote == 10 || vote ==5)
        {
            statItem.voteApprove++;
        }
        else if (vote == 0)
        {
            statItem.notVote++;
        }
        else if (vote == -5)
        {
            statItem.voteWait++;
        }
        else if(vote == -10)
        {
            statItem.voteReject++;
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
        let targetBranchChartData = getPieChartInfo(this.targetBranches);
        let reviewerPieChartData = getPieChartInfo(this.approverList.value);
        let groupBarChartData = getStackedBarChartInfo(this.approvalGroupList,"");
        let reviewerBarChartData = getStackedBarChartInfo(this.approverList.value, this.noReviewerText);
        let durationTrenChartData = getDurationBarChartInfo(this.durationSlices);
        let closedPRChartData = getPullRequestsCompletedChartInfo(this.durationSlices);
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

                    
                    <div>
                    <div className="flex-row">
                                        <div className="flex-column"> 
                                        <span className="flex-cell">
                                           Show Pull Requests Completed within: <Dropdown
                                                    ariaLabel="Basic"                                                    
                                                    placeholder="Select an Option"
                                                    width={500}
                                                    items={this.dateSelectionChoices}
                                                    selection={this.dateSelection}
                                                    onSelect={this.onSelect}
                                                />  
                                            </span>
                                            <span className="flex-cell">

                                            </span>
                                        </div>
                                    </div>
                                            <div className="flex-row">
                                                    <div className="flex-column" style={{minWidth:"225px"}}>
                                                        <div className="flex-row">
                                                        <Card titleProps={{text: this.displayText.value}}>          
                                                        <div className="flex-cell" style={{ flexWrap: "wrap" }}>                                
                                                                <div className="flex-column" style={{ minWidth: "200px" }} key={1}>                                              
                                                                    <div className="body-m secondary-text" style={{minWidth:"120px"}}>Count</div>
                                                                    <div className="title-m flex-center">{this.PRCount}</div>  
                                                                </div>
                                                        </div>                                                      
                                                        </Card>
                                                        </div>
                                                        <div className="flex-row" style={{minWidth:"375px"}}>
                                                        <Card titleProps={{ text:"Closed Pull Requests"}}>                                                                                                                    
                                                            <Bar data={closedPRChartData} height={200}></Bar>                                                                
                                                        </Card>
                                                    </div>
                                                    </div>
                                                    <div className="flex-column">
                                                    <div className="flex-row">
                                                    <Card titleProps={{ text: "Average Time Pull Requsts are Open" }}>
                                                        <div className="flex-cell" style={{ flexWrap: "wrap" }}>                                
                                                                <div className="flex-column" style={{ minWidth: "70px" }} key={1}>
                                                                    <div className="body-m secondary-text">Days</div>
                                                                    <div className="title-m primary-text flex-center">{this.durationDisplayObject.days.toString()}</div>
                                                                </div>                        
                                                                <div className="flex-column" style={{ minWidth: "70px" }} key={2}>
                                                                    <div className="body-m secondary-text">Hours</div>
                                                                    <div className="title-m primary-text flex-center">{this.durationDisplayObject.hours.toString()}</div>
                                                                </div>                        
                                                                <div className="flex-column" style={{ minWidth: "70px" }} key={3}>
                                                                    <div className="body-m secondary-text">Minutes</div>
                                                                    <div className="title-m primary-text flex-center">{this.durationDisplayObject.minutes.toString()}</div>
                                                                </div>                        
                                                                <div className="flex-column" style={{ minWidth: "70px" }} key={4}>
                                                                    <div className="body-m secondary-text">Seconds</div>
                                                                    <div className="title-m primary-text flex-center">{this.durationDisplayObject.seconds.toString()}</div>
                                                                </div>                        
                                                        </div>
                                                    </Card>
                                                    </div>
                                                    <div className="flex-row" style={{minWidth:"375px"}}>
                                                        <Card titleProps={{ text:"Duration Trends (2 week interval)"}}>                                                            
                                                            <table>
                                                                <tr><td>
                                                            <Bar data={durationTrenChartData} height={200}></Bar>
                                                                </td></tr>
                                                                <tr><td><span className="body-xs">Trends for the last year (max last 500 PRs)</span></td></tr>
                                                            </table>
                                                        </Card>
                                                    </div>
                                                </div>
                                                <div className="flex-column" style={{minWidth:"350px"}}>
                                                    <Card className="flex-grow"  titleProps={{ text: "Target Branches" }}>
                                                    <div className="flex-row" style={{ flexWrap: "wrap" }}>                  
                                                        <table> 
                                                            <thead>
                                                                <td></td>
                                                                <td style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>Count</td>
                                                                <td style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>Percent</td>
                                                            </thead>             
                                                        {this.targetBranches.map((items, index) => (
                                                            <tr>
                                                                <td className="body-m secondary-text">{items.name}</td>                                    
                                                                <td className="body-m primary-text flex-center" style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>{items.value}</td>
                                                                <td className="body-m primary-text flex-center" style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>{(items.value / this.PRCount * 100).toFixed(2)}%</td>
                                                            </tr>
                                                        ))}
                                                        </table>
                                                        </div>                                
                                                    </Card>
                                                </div>
                                                <div className="flex-column" style={{minWidth:"400"}}>
                                                    <Card className="flex-grow">
                                                    <div className="flex-row" style={{minWidth:"500px"}}>
                                                            <Doughnut data={targetBranchChartData} height={200}>                        
                                                            </Doughnut>
                                                        </div>
                                                    </Card>
                                                </div>

                                            </div>      
                                            <div className="flex-row">
      
                                            </div>
                                            <div className="flex-row">
                                                <div className="flex-column" style={{minWidth:"350px"}}>
                                                    <Card className="flex-grow" titleProps={{ text: "PR Code Reviewers" }}>
                                                        <div className="flex-row" style={{ flexWrap: "wrap" }}>             
                                                        <table>                   
                                                            <thead>
                                                                <td></td>
                                                                <td style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>Count</td>
                                                                <td style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>Percent of PRs</td>

                                                            </thead>
                                                            <Observer selectedItem={this.approverList}>
                                                                {(props: { selectedItem: statKeepers.IReviewWithVote[] }) => {
                                                                    return ( 
                                                                        <>
                                                                            {props.selectedItem.map((items, index) => (
                                                                            <tr>
                                                                                <td className="body-m secondary-text flex-center">{items.name}</td>
                                                                                <td className="body-m primary-text flex-center" style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>{items.value}</td>
                                                                                <td style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>{(items.value / this.PRCount * 100).toFixed(2)}%</td>
                                                                            </tr>
                                                                        ))}
                                                                        </>
                                                                    )}
                                                                }
                                                            </Observer>
                                                        </table>
                                                        </div>                                
                                                    </Card>
                                                </div>
                                                <div className="flex-column" style={{minWidth:"500"}}>
                                                    <Card className="flex-grow">
                                                    <div className="flex-row flex-grow flex-cell" style={{minWidth:"500px"}}>
                                                        <Doughnut  data={reviewerPieChartData} height={250}></Doughnut>
                                                    </div>
                                                    </Card>
                                                </div>
                                                <div className="flex-column">
                                                    <Card>
                                                        <div className="flex-row" style={{minWidth:500}}>                                    
                                                            <Bar data={reviewerBarChartData} options={stackedChartOptions} height={250}></Bar>                                    
                                                        </div>
                                                    </Card>
                                                </div>
                                            </div>

                                            <div className="flex-row">
                                            <div className="flex-column" style={{minWidth:"350px"}}>
                                                    <Card className="flex-grow" titleProps={{ text: "Approval by Team/Groups" }}>
                                                        <div className="flex-row" style={{ flexWrap: "wrap" }}>             
                                                        <table>                   
                                                            <thead>
                                                                <td></td>
                                                                <td style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>Count</td>
                                                                <td style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>Percent of PRs</td>

                                                            </thead>
                                                        {this.approvalGroupList.map((items, index) => (
                                                            <tr>
                                                                <td className="body-m secondary-text flex-center">{items.name}</td>
                                                                <td className="body-m primary-text flex-center" style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>{items.value}</td>
                                                                <td style={{alignContent:"center", textAlign:"center", minWidth:"85px"}}>{(items.value / this.PRCount * 100).toFixed(2)}%</td>

                                                            </tr>                                    
                                                        ))}
                                                        </table>
                                                        </div>                                
                                                    </Card>
                                                    
                                                </div>
                                                <Card>
                                                    <div className="flex-row" style={{minWidth:this.myBarChartDims.width, height:"250"}}>
                                                        <>
                                                            <Bar data={groupBarChartData} options={stackedChartOptions} height={250}></Bar>
                                                        </>
                                                    </div>
                                                </Card>
                                                
                                            </div>
                                            
                                            </div>

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