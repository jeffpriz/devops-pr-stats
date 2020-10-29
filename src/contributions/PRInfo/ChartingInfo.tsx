import * as statKeepers from "./statKeepers";

export interface IChartDataset
{
    data:number[],
    backgroundColor:string[]
}
export interface IChartData
{
    labels:string[],
    datasets:IChartDataset[]
}

export interface IBarChartDataset
{
    label:string,
    data:number[],
    backgroundColor:string
}

export interface IBarChartData
{
    labels:string[],
    datasets:IBarChartDataset[]
}

export var  stackedChartOptions = {
    scales: {
      yAxes: [
        {
          stacked: true,
          ticks: {
            beginAtZero: true,
          },
        },
      ],
      xAxes: [
        {
          stacked: true,
        },
      ],
    },
  }

export interface BarChartSize{
    height?:number,
    width?:number

}
export var NoVoteChartColor = "#990000";
export var ApproveChartColor = "#b3d9ff";
export var WaitVoteChartColor ="#661aff";
export var RejectVoteChartColor = "#e67300";

export var chartDataColors= [        
    '#F06B4F',
    '#b370b3', 
    '#221166',     
    '#F2AE52', 
    '#B0CD6D', 
    '#A33120',
    '#36A2EB',
    '#FFCE56',        
    '#00b300',
    '#0066ff',
    '#cc7a00',
    '#ffd11a',
    '#004080',
    '#99994d',
    '#d699ff',
    '#990000',
    '#4400cc',
    '#999900',
    '#204060',
    '#9494b8',
    '#b3d9ff',
    '#8080ff',
    '#e6ac00',
    '#4d0000',
    '#ffcc99',
    '#ff1a8c',
];

export function getPieChartInfo(data:statKeepers.INameCount[]):IChartData
{
    var d:IChartData = {labels:[],datasets:[]};
    var ds:IChartDataset ={data:[], backgroundColor:[]};
    var ndx:number =0;
    
    data.forEach((i)=>{
        d.labels.push(i.name);
        ds.backgroundColor.push(chartDataColors[ndx]);
        ds.data.push(i.value);
        ndx++;
        if(ndx >= chartDataColors.length)
        {
            ndx = 0;
        }
        
    });
    d.datasets.push(ds);

    return d;
}

export function getStackedBarChartInfo(data:statKeepers.IReviewWithVote[], exclude:string):IBarChartData
{
    var d:IBarChartData = {labels:[], datasets:[]};
    var countWaitVotes = statKeepers.getTotalCountForVoteWait(data);
    var countRejectVotes = statKeepers.getTotalCountForVoteReject(data);
    var approveDS:IBarChartDataset = {label:"Approve Votes", backgroundColor:ApproveChartColor, data:[]};
    var rejectDS:IBarChartDataset = {label:"Reject Votes", backgroundColor:RejectVoteChartColor, data:[]};
    var noVoteDS:IBarChartDataset = {label:"Did Not Vote", backgroundColor:NoVoteChartColor, data:[]};
    var waitVoteDS:IBarChartDataset = {label:"Waiting For Author", backgroundColor:WaitVoteChartColor, data:[]};

    data.forEach((thisData)=>{
        if(thisData.name != exclude)
        {
            d.labels.push(thisData.name);
            approveDS.data.push(thisData.voteApprove);            
            noVoteDS.data.push(thisData.notVote);
            if(countWaitVotes > 0)
              { waitVoteDS.data.push(thisData.voteWait); }
            if(countRejectVotes > 0)            
              { rejectDS.data.push(thisData.voteReject); }
        }
    });

    d.datasets.push(noVoteDS);
    d.datasets.push(approveDS);
    if(countWaitVotes > 0)
      { d.datasets.push(waitVoteDS); }
    if(countRejectVotes > 0) 
      {d.datasets.push(rejectDS);}
    
    return d;
}