import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {cloneDeep} from 'lodash';
import {Subscription} from 'rxjs';
import {Job, StepStatus} from '../../../../../model/job.model';
import {PipelineStatus, ServiceLog} from '../../../../../model/pipeline.model';
import {Project} from '../../../../../model/project.model';
import {WorkflowNodeJobRun, WorkflowNodeRun} from '../../../../../model/workflow.run.model';
import {AutoUnsubscribe} from '../../../../../shared/decorator/autoUnsubscribe';
import {DurationService} from '../../../../../shared/duration/duration.service';

@Component({
    selector: 'app-node-run-pipeline',
    templateUrl: './pipeline.html',
    styleUrls: ['./pipeline.scss']
})
@AutoUnsubscribe()
export class WorkflowRunNodePipelineComponent implements OnInit, OnDestroy {

    nodeRun: WorkflowNodeRun;
    jobTime: Map<number, string>;

    @Input() workflowName: string;
    @Input() project: Project;
    @Input('run')
    set run(data: WorkflowNodeRun) {
         this.refreshNodeRun(data);

         this.deleteInterval();
         this.updateTime();
         this.durationIntervalID = window.setInterval(() => {
             this.updateTime();
         }, 5000);
    }

    queryParamsSub: Subscription;
    pipelineStatusEnum = PipelineStatus;
    selectedRunJob: WorkflowNodeJobRun;
    mapJobStatus: Map<number, {status: string, warnings: number}> = new Map<number, {status: string, warnings: number}>();
    mapStepStatus: Map<string, StepStatus> = new Map<string, StepStatus>();

    previousStatus: string;
    manual = false;
    serviceLogsLoading = true;
    serviceLogs: Array<ServiceLog> = [];
    displayServiceLogs = false;

    durationIntervalID: number;

    constructor(
        private _durationService: DurationService,
        private _route: ActivatedRoute,
        private _router: Router
    ) {


    }

    ngOnInit() {
        this.updateSelectedItems(this._route.snapshot.queryParams);
        this.queryParamsSub = this._route.queryParams.subscribe((queryParams) => {
          this.updateSelectedItems(queryParams);
        });
    }

    updateSelectedItems(queryParams) {
      if (!queryParams['actionId'] && queryParams['stageId']) {
        this.selectedStage(parseInt(queryParams['stageId'], 10));
      } else if (queryParams['actionId']) {
        let job = new Job();
        job.pipeline_action_id = parseInt(queryParams['actionId'], 10);
        this.manual = true;
        this.selectedJob(job);
      }
    }

    selectedJobManual(j: Job) {
      let queryParams = cloneDeep(this._route.snapshot.queryParams);
      queryParams['stageId'] = null;
      queryParams['actionId'] = null;
      queryParams['stepOrder'] = null;
      queryParams['line'] = null;
      this.manual = true;

      this._router.navigate(['.'], { relativeTo: this._route, queryParams, fragment: null });
      this.selectedJob(j);
    }

    selectedStage(stageId: number) {
      let stage = this.nodeRun.stages.find((st) => st.id === stageId);

      if (stage && Array.isArray(stage.run_jobs) && stage.run_jobs.length) {
        this.selectedRunJob = stage.run_jobs[0];
      }
    }

    selectedJob(j: Job): void {
        this.nodeRun.stages.forEach(s => {
            if (s.run_jobs) {
                let runJob = s.run_jobs.find(rj => rj.job.pipeline_action_id === j.pipeline_action_id);
                if (runJob) {
                    this.selectedRunJob = runJob;
                }
            }
        });
    }

    refreshNodeRun(data: WorkflowNodeRun): void {
        let previousRun = this.nodeRun;
        this.nodeRun = data;

        if (this.nodeRun) {
            this.previousStatus = this.nodeRun.status;
        }
        // Set selected job if needed or refresh step_status
        if (this.nodeRun.stages) {
            this.nodeRun.stages.forEach((s, sIndex) => {
                if (!this.manual && previousRun && (!previousRun.stages[sIndex].status ||
                    previousRun.stages[sIndex].status === PipelineStatus.NEVER_BUILT) &&
                    (s.status === PipelineStatus.WAITING || s.status === PipelineStatus.BUILDING)) {
                  this.selectedJob(s.jobs[0]);
                }
                if (s.run_jobs) {
                    s.run_jobs.forEach((rj, rjIndex) => {
                        let warnings = 0;
                        // Update map step status
                        if (rj.job.step_status) {
                            rj.job.step_status.forEach(ss => {
                                this.mapStepStatus[rj.job.pipeline_action_id + '-' + ss.step_order] = ss;
                                if (ss.status === PipelineStatus.FAIL && rj.job.action.actions[ss.step_order] &&
                                    rj.job.action.actions[ss.step_order].optional) {
                                    warnings++;
                                }
                            });
                        }

                        // Update job status
                        this.mapJobStatus.set(rj.job.pipeline_action_id, {status: rj.status, warnings});

                        // Select temp job
                        if (!this.selectedRunJob && sIndex === 0 && rjIndex === 0) {
                            this.selectedRunJob = rj;
                        }

                        // Update spawninfo
                        if (this.selectedRunJob && this.selectedRunJob.id === rj.id) {
                            this.selectedRunJob.spawninfos = rj.spawninfos;
                        }
                    });
                }
            });
        }
    }

    updateTime(): void {
        this.jobTime = new Map<number, string>();
        let stillRunning = false;
        if (this.nodeRun.stages) {
            this.nodeRun.stages.forEach(s => {
               if (s.run_jobs) {
                   s.run_jobs.forEach(rj => {
                       switch (rj.status) {
                           case this.pipelineStatusEnum.WAITING:
                               stillRunning = true;
                               this.jobTime.set(rj.job.pipeline_action_id, this._durationService.duration(new Date(rj.queued), new Date()));
                               break;
                           case this.pipelineStatusEnum.BUILDING:
                               stillRunning = true;
                               this.jobTime.set(rj.job.pipeline_action_id, this._durationService.duration(new Date(rj.start), new Date()));
                               break;
                           case this.pipelineStatusEnum.SUCCESS:
                           case this.pipelineStatusEnum.FAIL:
                           case this.pipelineStatusEnum.STOPPED:
                               this.jobTime.set(rj.job.pipeline_action_id,
                                   this._durationService.duration( new Date(rj.start), new Date(rj.done) ));
                               break;
                       }

                       if (rj.job.step_status) {
                           rj.job.step_status.forEach(ss => {
                               this.mapStepStatus.set(rj.job.pipeline_action_id + '-' + ss.step_order, ss);
                           });
                       }
                   });
               }
            });
        }
        if (!stillRunning) {
            this.deleteInterval();
        }
     }

     ngOnDestroy(): void {
        this.deleteInterval();
     }

    deleteInterval(): void {
        if (this.durationIntervalID) {
            clearInterval(this.durationIntervalID);
            this.durationIntervalID = 0;
        }
     }
}
