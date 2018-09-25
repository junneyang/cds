import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {cloneDeep} from 'lodash';
import {ModalTemplate, SuiModalService, TemplateModalConfig} from 'ng2-semantic-ui';
import {ActiveModal} from 'ng2-semantic-ui/dist';
import {Subscription} from 'rxjs';
import {PermissionValue} from '../../../../../model/permission.model';
import {Project} from '../../../../../model/project.model';
import {
    WNode, WNodeHook,
    Workflow,
    WorkflowNode,
    WorkflowNodeJoin,
    WorkflowNodeOutgoingHook,
    WorkflowNodeTrigger,
    WorkflowPipelineNameImpact,
} from '../../../../../model/workflow.model';
import {WorkflowCoreService} from '../../../../../service/workflow/workflow.core.service';
import {WorkflowEventStore} from '../../../../../service/workflow/workflow.event.store';
import {WorkflowStore} from '../../../../../service/workflow/workflow.store';
import {AutoUnsubscribe} from '../../../../../shared/decorator/autoUnsubscribe';
import {ToastService} from '../../../../../shared/toast/ToastService';
import {WorkflowTriggerComponent} from '../../../../../shared/workflow/modal/trigger/workflow.trigger.component';
import {WorkflowNodeHookFormComponent} from '../../../../../shared/workflow/node/hook/form/hook.form.component';
import {HookEvent} from '../../../../../shared/workflow/node/hook/hook.event';

@Component({
    selector: 'app-workflow-sidebar-edit-node',
    templateUrl: './workflow.sidebar.edit.node.component.html',
    styleUrls: ['./workflow.sidebar.edit.node.component.scss']
})
@AutoUnsubscribe()
export class WorkflowSidebarEditNodeComponent implements OnInit {

    // Project that contains the workflow
    @Input() project: Project;
    @Input() workflow: Workflow;

    nodeSub: Subscription;

    // Child component
    @ViewChild('workflowTrigger')
    workflowTrigger: WorkflowTriggerComponent;
    @ViewChild('workflowTriggerParent')
    workflowTriggerParent: WorkflowTriggerComponent;
    @ViewChild('worklflowAddHook')
    worklflowAddHook: WorkflowNodeHookFormComponent;
    @ViewChild('worklflowAddOutgoingHook')
    worklflowAddOutgoingHook: WorkflowNodeHookFormComponent;
    @ViewChild('nodeNameWarningModal')
    nodeNameWarningModal: ModalTemplate<boolean, boolean, void>;

    // Modal
    @ViewChild('nodeParentModal')
    nodeParentModal: ModalTemplate<boolean, boolean, void>;
    newParentNode: WorkflowNode;
    newTrigger: WorkflowNode = new WorkflowNode();
    node: WNode;
    previousNodeName: string;
    displayInputName = false;
    loading = false;
    nameWarning: WorkflowPipelineNameImpact;
    permissionEnum = PermissionValue;
    isChildOfOutgoingHook = false;

    constructor(private _workflowStore: WorkflowStore, private _translate: TranslateService, private _toast: ToastService,
                private _modalService: SuiModalService,
                private _router: Router,
                private _workflowCoreService: WorkflowCoreService, private _workflowEventStore: WorkflowEventStore) {}

    ngOnInit(): void {
        this.nodeSub = this._workflowEventStore.selectedNode().subscribe(n => {
            if (n) {
                if (!this.displayInputName) {
                    this.previousNodeName = n.name
                }
                if (this.workflow) {
                    this.isChildOfOutgoingHook = Workflow.isChildOfOutgoingHook(this.workflow, null, null, n.id);
                }
            }
            this.node = n;
        });
    }

    canEdit(): boolean {
        return this.workflow.permission === PermissionValue.READ_WRITE_EXECUTE;
    }

    openAddHookModal(): void {
        if (this.canEdit() && this.worklflowAddHook) {
            this.worklflowAddHook.show();
        }
    }

    openAddOutgoingHookModal(): void {
        if (this.canEdit() && this.worklflowAddOutgoingHook) {
            this.worklflowAddOutgoingHook.show();
        }
    }

    openTriggerModal(): void {
        if (!this.canEdit()) {
            return;
        }
        this.newTrigger = new WorkflowNode();
        if (this.workflowTrigger) {
          this.workflowTrigger.show();
        }
    }

    openAddParentModal(): void {
        if (!this.canEdit()) {
            return;
        }
        this.newParentNode = new WorkflowNode();
        if (this.workflowTriggerParent) {
          this.workflowTriggerParent.show();
        }
    }

    addNewParentNode(): void {
        let workflowToUpdate = cloneDeep(this.workflow);
        let oldRoot = cloneDeep(this.workflow.root);
        workflowToUpdate.root = this.newParentNode;
        if (oldRoot.hooks) {
            workflowToUpdate.root.hooks = oldRoot.hooks;
        }
        delete oldRoot.hooks;
        workflowToUpdate.root.triggers = new Array<WorkflowNodeTrigger>();
        let t = new WorkflowNodeTrigger();
        t.workflow_dest_node = oldRoot;
        workflowToUpdate.root.triggers.push(t);

        this.updateWorkflow(workflowToUpdate, this.workflowTriggerParent.modal);
    }

    openWarningModal(): void {
        let tmpl = new TemplateModalConfig<boolean, boolean, void>(this.nodeNameWarningModal);
        this._modalService.open(tmpl);
    }

    saveTrigger(): void {
        // TODO
        /*
        if (!this.canEdit()) {
            return;
        }
        let clonedWorkflow: Workflow = cloneDeep(this.workflow);
        let currentNode: WorkflowNode;
        if (clonedWorkflow.root.id === this.node.id) {
            currentNode = clonedWorkflow.root;
        } else {
            currentNode = Workflow.getNodeByID(this.node.id, clonedWorkflow);
        }

        if (!currentNode) {
            return;
        }

        if (!currentNode.triggers) {
            currentNode.triggers = new Array<WorkflowNodeTrigger>();
        }
        let trig = new WorkflowNodeTrigger();
        trig.workflow_node_id = this.node.id;
        trig.workflow_dest_node = this.newTrigger;
        currentNode.triggers.push(trig);
        this.updateWorkflow(clonedWorkflow, this.workflowTrigger.modal);
        */
    }

    removeNodeFromJoin(workflow: Workflow, id: number, node: WorkflowNode, parent: WorkflowNodeJoin, index: number) {
        if (!this.canEdit()) {
            return;
        }
        if (node.id === id) {
            parent.triggers.splice(index, 1);
        }
        if (node.triggers) {
            node.triggers.forEach((t, i) => {
                this.removeNode(workflow, id, t.workflow_dest_node, node, i);
            });
        }
        if (node.outgoing_hooks) {
            node.outgoing_hooks.forEach(h => {
                if (h.triggers) {
                    h.triggers.forEach((t, i) => {
                        this.removeNodeFromOutgoingHook(workflow, id, t.workflow_dest_node, h, i);
                    });
                }
            });
        }
    }

    removeNodeFromOutgoingHook(workflow: Workflow, id: number, node: WorkflowNode, parent: WorkflowNodeOutgoingHook, index: number) {
        if (!this.canEdit()) {
            return;
        }
        if (node.id === id) {
            parent.triggers.splice(index, 1);
        }
        if (node.triggers) {
            node.triggers.forEach((t, i) => {
                this.removeNode(workflow, id, t.workflow_dest_node, node, i);
            });
        }
        if (node.outgoing_hooks) {
            node.outgoing_hooks.forEach(h => {
                if (h.triggers) {
                    h.triggers.forEach((t, i) => {
                        this.removeNodeFromOutgoingHook(workflow, id, t.workflow_dest_node, h, i);
                    });
                }
            });
        }
    }

    removeNode(workflow: Workflow, id: number, node: WorkflowNode, parent: WorkflowNode, index: number): Workflow {
        if (!this.canEdit()) {
            return;
        }
        if (node.id === id) {
            parent.triggers.splice(index, 1);
            workflow = Workflow.removeNodeInNotifications(workflow, node);
        }
        if (node.triggers) {
            node.triggers.forEach((t, i) => {
                workflow = this.removeNode(workflow, id, t.workflow_dest_node, node, i);
            });
        }
        if (node.outgoing_hooks) {
            node.outgoing_hooks.forEach(h => {
                if (h.triggers) {
                    h.triggers.forEach((t, i) => {
                        this.removeNodeFromOutgoingHook(workflow, id, t.workflow_dest_node, h, i);
                    });
                }
            });
        }
        return workflow;
    }

    deleteWorkflow(w: Workflow, modal: ActiveModal<boolean, boolean, void>): void {
        this._workflowStore.deleteWorkflow(this.project.key, w).subscribe(() => {
            this._toast.success('', this._translate.instant('workflow_deleted'));
            modal.approve(true);
            this._workflowEventStore.unselectAll();
            this._router.navigate(['/project', this.project.key], { queryParams: { tab: 'workflows'}});
        });
    }

    updateWorkflow(w: Workflow, modal?: ActiveModal<boolean, boolean, void>): void {
        this.loading = true;
        this._workflowStore.updateWorkflow(this.project.key, w).subscribe(() => {
            this.loading = false;
            this._toast.success('', this._translate.instant('workflow_updated'));
            this._workflowEventStore.unselectAll();
            if (modal) {
                modal.approve(null);
            }
        }, () => {
            if (Array.isArray(this.node.hooks) && this.node.hooks.length) {
              this.node.hooks.pop();
            }
            this.loading = false;
        });
    }

    createFork(): void {
        // TODO
        /*
        if (!this.canEdit()) {
            return;
        }
        let clonedWorkflow: Workflow = cloneDeep(this.workflow);
        let currentNode: WNode;
        if (clonedWorkflow.root.id === this.node.id) {
            currentNode = clonedWorkflow.root;
        } else {
            currentNode = Workflow.getNodeByID(this.node.id, clonedWorkflow);
        }
        if (!currentNode) {
            return;
        }

        if (!currentNode.forks) {
            currentNode.forks = new Array<WorkflowNodeFork>();
        }

        let f = new WorkflowNodeFork();
        f.workflow_node_id = currentNode.id;
        currentNode.forks.push(f);

        this.updateWorkflow(clonedWorkflow);
        */
    }

    createJoin(): void {
        if (!this.canEdit()) {
            return;
        }
        if (!this.node.ref) {
            this.node.ref = this.node.id.toString();
        }
        let clonedWorkflow: Workflow = cloneDeep(this.workflow);
        if (!clonedWorkflow.joins) {
            clonedWorkflow.joins = new Array<WorkflowNodeJoin>();
        }
        let j = new WorkflowNodeJoin();
        j.source_node_ref.push(this.node.ref);
        clonedWorkflow.joins.push(j);
        this.updateWorkflow(clonedWorkflow);
    }

    openRenameArea(): void {
        if (!this.canEdit()) {
            return;
        }
        this.nameWarning = Workflow.getNodeNameImpact(this.workflow, this.node.name);
        this.displayInputName = true;
    }

    linkJoin(): void {
        if (!this.canEdit()) {
            return;
        }
        this._workflowCoreService.linkJoinEvent(this.node);
    }

    addHook(he: HookEvent): void {
        if (!this.canEdit()) {
            return;
        }
        if (!this.node.hooks) {
            this.node.hooks = new Array<WNodeHook>();
        }
        this.node.hooks.push(he.hook);
        this.updateWorkflow(this.workflow, this.worklflowAddHook.modal);
    }

    addOutgoingHook(he: HookEvent): void {
        /*
        if (!this.canEdit()) {
            return;
        }
        if (!this.node.triggers) {
            this.node.outgoing_hooks = new Array<WorkflowNodeOutgoingHook>();
        }
        let oh = new WorkflowNodeOutgoingHook();
        oh.config = he.hook.config
        oh.id = he.hook.id
        oh.model = he.hook.model
        this.node.outgoing_hooks.push(oh);
        this.updateWorkflow(this.workflow, this.worklflowAddOutgoingHook.modal);
         */
        // TODO
    }
}
