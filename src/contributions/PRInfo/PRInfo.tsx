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
import { PieChart } from 'react-chartkick'
import 'chart.js'

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
    private targetBranches:statKeepers.INameCount[];
    private branchDictionary:Map<string, statKeepers.INameCount>;

    private approverList: statKeepers.INameCount[];
    private approverDictionary:Map<string, statKeepers.INameCount>;

    public readonly noReviewerText:string ="No Reviewer";

    public PRCount:number = 0;
    
    constructor(props: {}) {
        super(props);
        this.tableArrayData=this.getTableItemProvider([]);
        this.itemProvider = new ObservableArray<ITableItem | ObservableValue<ITableItem | undefined>>(this.getTableItemProvider([]).value);
        this.state = { repository: null,   exception: "", isToastFadingOut:false, isToastVisible:false, foundCompletedPRs:true, doneLoading:false};
        this.totalDuration = 0;
        this.durationDisplayObject = {days:0, hours:0, minutes:0, seconds:0, milliseconds:0};
        this.targetBranches =[];
        this.branchDictionary = new Map<string,statKeepers.INameCount>();

        this.approverList = [];
        this.approverDictionary = new Map<string, statKeepers.INameCount>();
        this.approverDictionary.set(this.noReviewerText, {name:this.noReviewerText,value:0});

    }

    public async componentDidMount() {
        await SDK.init();
        try{
            const repoSvc = await SDK.getService<IVersionControlRepositoryService>(GitServiceIds.VersionControlRepositoryService);
            var repository = await repoSvc.getCurrentGitRepository();
            var exception = "";       
            //var count:number = -1;
            let prTableList:ITableItem[] = []
            let prTableArrayObj:ArrayItemProvider<ITableItem> = this.getTableItemProvider([]);
            
            
            
            if(repository)
            {            
                let prList:GitPullRequest[] = await this.retrievePullRequestRowsFromADO(repository.id);
                prTableList = await this.getPullRequestRows(prList);
                prTableArrayObj = this.getTableItemProvider(prTableList);
                this.PRCount = prTableList.length;
                if(this.PRCount < 1)
                {
                    this.setState({foundCompletedPRs:false, repository:this.state.repository, isToastFadingOut:false, isToastVisible:false, exception:"", doneLoading:true});
                }
                else
                {
                    let averageOpenTime = this.totalDuration / this.PRCount;
                    
                    this.branchDictionary.forEach((thisBranchItem) =>{
                        this.targetBranches.push(thisBranchItem);
                    });
                    this.approverDictionary.forEach((value)=>{
                        this.approverList.push(value);
                    })
                    this.durationDisplayObject = statKeepers.getMillisecondsToTime(averageOpenTime);
                    this.setState({doneLoading:true});

                    //let chart = create("chartdiv", PieChart);
                    //chart.data = this.targetBranches;
                    //let pieSeries = chart.series.push(new PieSeries());
                    //chart.innerRadius = percent(40);
                    //pieSeries.dataFields.value = "value";
                    //pieSeries.dataFields.category = "name";


                }
                console.log("Done with the PR Extension");
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
            status:item.status,
            reviewerCount: item.reviewerCount
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

        
        let rows:ITableItem[] = [];
        try{
            if(prList)
            {        
                prList.forEach((value)=>{
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
                });
            }
            else{
                this.setState({foundCompletedPRs:false, repository:this.state.repository, isToastFadingOut:false, isToastVisible:false, exception:"", doneLoading:true});
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

    private AddPRTargetBranchToStat(thisPR:GitPullRequest)
    {
        let branchnameOnly = thisPR.targetRefName.replace("refs/heads/","")
        if(this.branchDictionary.has(branchnameOnly))
        {
            let thisref = this.branchDictionary.get(branchnameOnly);
            if(thisref)
            {
                thisref.value = thisref.value +1;                
            }
            
        }
        else
        {
            this.branchDictionary.set(branchnameOnly, {name: branchnameOnly, value:1});
        }
    }

    private AddPRReviewerToStat(thisPR:GitPullRequest)
    {

        if(thisPR.reviewers.length > 0)
        {
            thisPR.reviewers.forEach(value =>{
               this.AddPRIdentityToStat(value);
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
                this.approverDictionary.set(thisID, thisApprover);          
            
            }
            
        }
        else {
            
            this.approverDictionary.set(thisID, {name:thisName, value:1});
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


//    private reWriteChartData(inData:statKeepers.INameCount[]):DataEntry[]
 //   {
 //       let returnData:DataEntry[] = [];
 //       inData.forEach(value =>{
 //           let i:DataEntry = {title: value.name, value:value.value, color:this.randomColor()};
 //           returnData.push(i)
 //       });
 //       return returnData;
 //   }

    private randomColor(){

          return '#' + this.randomChannel(150) + this.randomChannel(150) + this.randomChannel(150);
      }
    
    private randomChannel(brightness:number){
        var r = 255-brightness;
        var n = 0|((Math.random() * r) + brightness);
        var s = n.toString(16);
        return (s.length==1) ? '0'+s : s;
      }
    public render(): JSX.Element {
        let isToastVisible = this.state.isToastVisible;
        let foundCompletedPRs = this.state.foundCompletedPRs;
        let doneLoading = this.state.doneLoading;
        

        if(doneLoading)
        {
            if(true)
            {

                return(
                    <div>
                    <PieChart width={1000} height={500} data={[["Blueberry", 44], ["Strawberry", 23], ["Raspberry",55]]}>
                        
                    </PieChart>
                    </div>
                )
            }

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

                    <div className="flex-center">
                    <div className="flex-row flex-center">
                        <div className="flex-column">
                        <Card className="flex-grow" titleProps={{ text: "Average Time Pull Requsts are Open" }}>
                            <div className="flex-row" style={{ flexWrap: "wrap" }}>                                
                                    <div className="flex-column" style={{ minWidth: "70px" }} key={1}>
                                        <div className="body-m secondary-text">Days</div>
                                        <div className="body-m primary-text flex-center">{this.durationDisplayObject.days.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "70px" }} key={2}>
                                        <div className="body-m secondary-text">Hours</div>
                                        <div className="body-m primary-text flex-center">{this.durationDisplayObject.hours.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "70px" }} key={3}>
                                        <div className="body-m secondary-text">Minutes</div>
                                        <div className="body-m primary-text flex-center">{this.durationDisplayObject.minutes.toString()}</div>
                                    </div>                        
                                    <div className="flex-column" style={{ minWidth: "70px" }} key={1}>
                                        <div className="body-m secondary-text">Seconds</div>
                                        <div className="body-m primary-text flex-center">{this.durationDisplayObject.seconds.toString()}</div>
                                    </div>                        
                            </div>
                        </Card>
                        </div>
                    </div>
                    
                    <div className="flex-row">
                        <div className="flex-column">
                            <Card className="flex-grow"  titleProps={{ text: "Target Branches" }}>
                                <div style={{width:"600px"}}>
                                <div id="chartdiv" style={{ width: "200px", height: "200px" }}>
   
                                </div>
                                </div>
                            </Card>
                        </div>
                        <div className="flex-column">
                            <Card className="flex-grow" titleProps={{ text: "PR Code Reviewers" }}>
                                <div className="flex-row" style={{ flexWrap: "wrap" }}>                                
                                {this.approverList.map((items, index) => (
                                    <div className="flex-column" style={{ minWidth: "120px" }} key={index}>
                                        <div className="body-m secondary-text">{items.name}</div>
                                        <div className="body-m primary-text flex-center">{items.value} - {(items.value / this.PRCount * 100).toFixed(2)}%</div>
                                    </div>
                                ))}
                                </div>
                            </Card>
                        </div>
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