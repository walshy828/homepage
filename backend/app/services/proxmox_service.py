"""
Homepage Dashboard - Proxmox Service
"""
from typing import List, Optional
from proxmoxer import ProxmoxAPI

from app.core.config import settings
from app.schemas import ProxmoxVM, ProxmoxNode, ProxmoxResponse


class ProxmoxService:
    """Service for Proxmox VE integration."""
    
    def __init__(self):
        self._api = None
        self._initialize_api()
    
    def _initialize_api(self):
        """Initialize Proxmox API client."""
        if not settings.is_proxmox_configured:
            return
        
        try:
            # Extract host without protocol
            host = settings.proxmox_host
            if host.startswith("https://"):
                host = host[8:]
            elif host.startswith("http://"):
                host = host[7:]
            
            # Remove port if present in host
            if ":" in host:
                host = host.split(":")[0]
            
            self._api = ProxmoxAPI(
                host,
                user=settings.proxmox_user,
                token_name=settings.proxmox_token_name,
                token_value=settings.proxmox_token_value,
                verify_ssl=settings.proxmox_verify_ssl
            )
        except Exception as e:
            print(f"Proxmox API initialization failed: {e}")
            self._api = None
    
    @property
    def is_available(self) -> bool:
        """Check if Proxmox is available."""
        if self._api is None:
            return False
        try:
            self._api.version.get()
            return True
        except Exception:
            return False
    
    def get_status(self) -> ProxmoxResponse:
        """Get Proxmox cluster status including nodes and VMs."""
        if not self.is_available:
            return ProxmoxResponse(nodes=[], vms=[])
        
        try:
            nodes = []
            vms = []
            
            # Get nodes
            for node_data in self._api.nodes.get():
                node = ProxmoxNode(
                    node=node_data["node"],
                    status=node_data.get("status", "unknown"),
                    cpu=round(node_data.get("cpu", 0) * 100, 2),
                    maxcpu=node_data.get("maxcpu", 0),
                    mem=node_data.get("mem", 0),
                    maxmem=node_data.get("maxmem", 0),
                    disk=node_data.get("disk", 0),
                    maxdisk=node_data.get("maxdisk", 0),
                    uptime=node_data.get("uptime", 0)
                )
                nodes.append(node)
                
                # Get VMs (QEMU) for this node
                try:
                    for vm_data in self._api.nodes(node_data["node"]).qemu.get():
                        vm = ProxmoxVM(
                            vmid=vm_data["vmid"],
                            name=vm_data.get("name", f"VM {vm_data['vmid']}"),
                            node=node_data["node"],
                            type="qemu",
                            status=vm_data.get("status", "unknown"),
                            cpu=round(vm_data.get("cpu", 0) * 100, 2),
                            maxcpu=vm_data.get("maxcpu", 0),
                            mem=vm_data.get("mem", 0),
                            maxmem=vm_data.get("maxmem", 0),
                            disk=vm_data.get("disk", 0),
                            maxdisk=vm_data.get("maxdisk", 0),
                            uptime=vm_data.get("uptime")
                        )
                        vms.append(vm)
                except Exception as e:
                    print(f"Error getting QEMU VMs for {node_data['node']}: {e}")
                
                # Get LXC containers for this node
                try:
                    for lxc_data in self._api.nodes(node_data["node"]).lxc.get():
                        lxc = ProxmoxVM(
                            vmid=lxc_data["vmid"],
                            name=lxc_data.get("name", f"CT {lxc_data['vmid']}"),
                            node=node_data["node"],
                            type="lxc",
                            status=lxc_data.get("status", "unknown"),
                            cpu=round(lxc_data.get("cpu", 0) * 100, 2),
                            maxcpu=lxc_data.get("maxcpu", 0),
                            mem=lxc_data.get("mem", 0),
                            maxmem=lxc_data.get("maxmem", 0),
                            disk=lxc_data.get("disk", 0),
                            maxdisk=lxc_data.get("maxdisk", 0),
                            uptime=lxc_data.get("uptime")
                        )
                        vms.append(lxc)
                except Exception as e:
                    print(f"Error getting LXC containers for {node_data['node']}: {e}")
            
            return ProxmoxResponse(nodes=nodes, vms=vms)
        except Exception as e:
            print(f"Error getting Proxmox status: {e}")
            return ProxmoxResponse(nodes=[], vms=[])
    
    def start_vm(self, node: str, vmid: int, vm_type: str = "qemu") -> bool:
        """Start a VM or container."""
        if not self.is_available:
            return False
        try:
            if vm_type == "qemu":
                self._api.nodes(node).qemu(vmid).status.start.post()
            else:
                self._api.nodes(node).lxc(vmid).status.start.post()
            return True
        except Exception as e:
            print(f"Error starting {vm_type} {vmid}: {e}")
            return False
    
    def stop_vm(self, node: str, vmid: int, vm_type: str = "qemu") -> bool:
        """Stop a VM or container."""
        if not self.is_available:
            return False
        try:
            if vm_type == "qemu":
                self._api.nodes(node).qemu(vmid).status.stop.post()
            else:
                self._api.nodes(node).lxc(vmid).status.stop.post()
            return True
        except Exception as e:
            print(f"Error stopping {vm_type} {vmid}: {e}")
            return False


# Singleton instance
proxmox_service = ProxmoxService()
