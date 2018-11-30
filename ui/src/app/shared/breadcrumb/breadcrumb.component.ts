import { Component, Input } from '@angular/core';
import { Project } from '../../model/project.model';
import { Workflow } from '../../model/workflow.model';
import { WorkflowRun } from '../../model/workflow.run.model';

@Component({
    selector: 'app-breadcrumb',
    templateUrl: './breadcrumb.html',
    styleUrls: ['./breadcrumb.scss']
})
export class BreadcrumbComponent {
    @Input() project: Project;
    @Input() workflow: Workflow;
    @Input() workflowRun: WorkflowRun;
}
